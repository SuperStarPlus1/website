# Attendance clock connector (same file in Sidurit web/app/clock/ and on the Superstar site). The app downloads it as
# ONE double-click file ("חיבור-שעון.cmd": a small launcher + this script in base64, with the company, the server and a
# one-time pairing code filled in — see web/app/clock.js). Nothing is typed by the user except, when needed, the
# clock software's own user name and password, or — when the software is not found where it is usually installed —
# the existing place (a file / folder / address), picked in a normal dialog.
#   no arguments  the setup window: find the software → connect (pairing code → this computer's own key, kept
#                 DPAPI-encrypted for this Windows user; only its SHA-256 is on the server) → a scheduled task every
#                 10 minutes → a first sync, with the result on screen
#   -Sync         one sync (what the scheduled task runs): read the punches → importAttendanceDat → clockStatus
# Models and methods: _shared/clock-core.ts (mdb · api · folder). Server: _shared/clock-handlers.ts.
param([switch]$Sync, [int]$Days = 0)

$Version = '1.0'
# ===== filled in by the app when downloaded =====
$Api = '__API__'
$Company = '__COMPANY__'
$PairCode = '__PAIR__'
$Kind = '__KIND__'
$Product = '__PRODUCT__'
$KindLabel = '__LABEL__'
# ================================================
$Name = if ($Company) { $Company } else { 'main' }
$Dir = Join-Path $env:LOCALAPPDATA ('SiduritClock\' + $Name)
$ConfPath = Join-Path $Dir 'config.json'
$KeyPath = Join-Path $Dir 'key.dpapi'
$LoginPath = Join-Path $Dir 'login.dpapi'
$LogPath = Join-Path $Dir 'sync_log.txt'
$ResultPath = Join-Path $Dir 'last_result.json'
$TaskName = 'SiduritClockSync-' + $Name
Add-Type -AssemblyName System.Security
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$METHOD = @{ lumen = 'mdb'; zk = 'mdb'; anviz = 'mdb'; zkbiotime = 'api'; biostar = 'api'; synel = 'folder'; hikvision = 'folder'; timemoto = 'folder'; other = 'folder' }

function Protect([string]$s) { [Security.Cryptography.ProtectedData]::Protect([Text.Encoding]::UTF8.GetBytes($s), $null, 'CurrentUser') }
function Unprotect([string]$path) { [Text.Encoding]::UTF8.GetString([Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($path), $null, 'CurrentUser')) }
function Post($body) {
  if ($Company) { $body.company = $Company }
  $bytes = [Text.Encoding]::UTF8.GetBytes(($body | ConvertTo-Json -Depth 6 -Compress))
  return Invoke-RestMethod -Uri $Api -Method Post -Body $bytes -ContentType 'application/json; charset=utf-8' -TimeoutSec 120
}
function Log([string]$s) {
  try {
    if ((Test-Path $LogPath) -and (Get-Item $LogPath).Length -gt 1MB) { Move-Item $LogPath ($LogPath + '.old') -Force }
    Add-Content -Path $LogPath -Value ((Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + '  ' + $s) -Encoding UTF8
  } catch { }
}
# self-signed certificates on the local server (BioStar) — only for that address
function Trust-LocalCerts {
  if (-not ('TrustAll' -as [type])) {
    Add-Type @"
using System.Net; using System.Security.Cryptography.X509Certificates;
public class TrustAll : ICertificatePolicy { public bool CheckValidationResult(ServicePoint s, X509Certificate c, WebRequest r, int p) { return true; } }
"@
  }
  [Net.ServicePointManager]::CertificatePolicy = New-Object TrustAll
}

# ---------------- finding the software ----------------
function Find-File([string[]]$paths, [string[]]$names) {
  foreach ($p in $paths) { if ($p -and (Test-Path -LiteralPath $p)) { return $p } }
  $roots = @(${env:ProgramFiles(x86)}, $env:ProgramFiles, 'C:\', 'D:\') | Where-Object { $_ -and (Test-Path $_) } | Select-Object -Unique
  foreach ($r in $roots) {
    foreach ($n in $names) {
      $f = Get-ChildItem -Path $r -Filter $n -Recurse -Depth 3 -File -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notmatch '\\(Windows|Backup|backup)\\' } | Select-Object -First 1
      if ($f) { return $f.FullName }
    }
  }
  return $null
}
function Probe-Web([string[]]$urls, [string]$pattern) {
  foreach ($u in $urls) {
    try {
      $r = Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec 4
      if ($r.Content -match $pattern) { return $u.TrimEnd('/') }
    } catch { }
  }
  return $null
}
function Find-Source([string]$kind) {
  $pf86 = ${env:ProgramFiles(x86)}; $pf = $env:ProgramFiles
  switch ($kind) {
    'lumen' { return Find-File @('C:\lumen\att2000.mdb', 'D:\lumen\att2000.mdb', 'C:\Lumen\att2000.mdb', "$pf86\Lumen\att2000.mdb") @('att2000.mdb') }
    'zk' { return Find-File @("$pf86\Att2000\att2000.mdb", "$pf\Att2000\att2000.mdb", "$pf86\ZKTeco\ATT2000\att2000.mdb", "$pf\ZKTeco\ATT2000\att2000.mdb",
        "$pf86\ZKTime5.0\att2000.mdb", "$pf\ZKTime5.0\att2000.mdb", 'C:\ZKTime5.0\att2000.mdb', 'C:\ZKTime\att2000.mdb', 'C:\att2000\att2000.mdb') @('att2000.mdb') }
    'anviz' { return Find-File @("$pf86\Anviz\CrossChex Standard\DB\CrossChex.mdb", "$pf\Anviz\CrossChex Standard\DB\CrossChex.mdb",
        "$pf86\Anviz\CrossChex Standard\Att2003.mdb", "$pf\Anviz\CrossChex Standard\Att2003.mdb") @('CrossChex.mdb', 'Att2003.mdb') }
    'zkbiotime' { return Probe-Web @('http://localhost:80/', 'http://localhost:8081/', 'http://localhost:8080/', 'http://localhost:81/', 'http://localhost:8088/') 'BioTime|ZKBio|biotime' }
    'biostar' { Trust-LocalCerts; return Probe-Web @('https://localhost/', 'https://localhost:443/', 'https://localhost:8443/', 'https://localhost:4443/') 'BioStar|biostar' }
    'synel' {
      foreach ($d in @('C:\Synel\Export', 'C:\Synel', 'C:\Harmony\Export', 'C:\Harmony', "$pf86\Synel", "$pf\Synel")) {
        if ((Test-Path $d) -and (Get-ChildItem $d -File -Include *.dat, *.txt, *.csv -Recurse -Depth 1 -ErrorAction SilentlyContinue | Select-Object -First 1)) { return $d }
      }
      return $null
    }
    default { return $null }   # hikvision / timemoto / other: the export folder is chosen by the user
  }
}

# ---------------- reading the punches ----------------
$TYPE_IN = -join @(0x05DB, 0x05E0, 0x05D9, 0x05E1, 0x05D4 | ForEach-Object { [char]$_ })
$TYPE_OUT = -join @(0x05D9, 0x05E6, 0x05D9, 0x05D0, 0x05D4 | ForEach-Object { [char]$_ })
function TypeOf($v) {
  $s = ([string]$v).Trim().ToUpper()
  if ($s -in @('I', 'IN', 'B', 'C/IN', 'CHECK-IN', 'CHECK IN', $TYPE_IN)) { return 'in' }
  if ($s -in @('O', 'OUT', 'E', 'C/OUT', 'CHECK-OUT', 'CHECK OUT', $TYPE_OUT)) { return 'out' }
  return ''
}
function Rec($emp, [datetime]$t, $type) { [PSCustomObject]@{ emp = ([string]$emp).Trim().TrimStart('0'); at = $t; type = $type } }

function Read-Mdb($conf, [datetime]$since) {
  # an optional refresh program next to the database (Lumen's auto.bat) pulls the clock into the file first
  if ($conf.refresh -and (Test-Path -LiteralPath $conf.refresh)) {
    try { $p = Start-Process -FilePath $conf.refresh -PassThru -WorkingDirectory (Split-Path $conf.refresh) -WindowStyle Hidden; if (-not $p.WaitForExit(60000)) { try { $p.Kill() } catch { } } } catch { Log ('refresh failed: ' + $_.Exception.Message) }
  }
  if (-not (Test-Path -LiteralPath $conf.source)) { throw ('קובץ הנתונים של תוכנת השעון לא נמצא: ' + $conf.source) }
  $conn = $null
  foreach ($prov in @('Microsoft.Jet.OLEDB.4.0', 'Microsoft.ACE.OLEDB.12.0', 'Microsoft.ACE.OLEDB.16.0')) {
    try { $c = New-Object Data.OleDb.OleDbConnection("Provider=$prov;Data Source=$($conf.source);Mode=Share Deny None;"); $c.Open(); $conn = $c; break } catch { }
  }
  if (-not $conn) { throw 'לא ניתן לפתוח את קובץ הנתונים (Access) — ייתכן שהתוכנה פתוחה בבלעדיות או שחסר רכיב Access' }
  try {
    $tables = $conn.GetOleDbSchemaTable([Data.OleDb.OleDbSchemaGuid]::Tables, [object[]]@($null, $null, $null, 'TABLE')) | ForEach-Object { $_.TABLE_NAME }
    $tbl = $tables | Where-Object { $_ -ieq 'CHECKINOUT' } | Select-Object -First 1
    if (-not $tbl) { throw 'בקובץ אין טבלת החתמות (CHECKINOUT)' }
    $cols = $conn.GetOleDbSchemaTable([Data.OleDb.OleDbSchemaGuid]::Columns, [object[]]@($null, $null, [string]$tbl, $null)) | ForEach-Object { $_.COLUMN_NAME }
    $cUser = $cols | Where-Object { $_ -imatch '^(USERID|USER_ID|USERNO)$' } | Select-Object -First 1
    $cTime = $cols | Where-Object { $_ -imatch '^(CHECKTIME|CHECK_TIME|PUNCHTIME)$' } | Select-Object -First 1
    $cType = $cols | Where-Object { $_ -imatch '^(CHECKTYPE|CHECK_TYPE)$' } | Select-Object -First 1
    if (-not $cUser -or -not $cTime) { throw 'מבנה טבלת ההחתמות לא מוכר' }
    # ZKTeco: the number on the clock is USERINFO.BADGENUMBER (Lumen keeps its own USERID numbering)
    $badge = @{}
    if ($conf.kind -eq 'zk' -and ($tables | Where-Object { $_ -ieq 'USERINFO' })) {
      $cm = $conn.CreateCommand(); $cm.CommandText = 'SELECT USERID, BADGENUMBER FROM USERINFO'
      try { $rd = $cm.ExecuteReader(); while ($rd.Read()) { $badge[[string]$rd[0]] = [string]$rd[1] }; $rd.Close() } catch { }
    }
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = "SELECT [$cUser], [$cTime]" + $(if ($cType) { ", [$cType]" } else { '' }) + " FROM [$tbl] WHERE [$cTime] >= ?"
    $p = $cmd.CreateParameter(); $p.OleDbType = [Data.OleDb.OleDbType]::Date; $p.Value = $since; $cmd.Parameters.Add($p) | Out-Null
    $rd = $cmd.ExecuteReader(); $out = New-Object Collections.Generic.List[object]
    while ($rd.Read()) {
      $t = $rd[1]; if (-not ($t -is [datetime])) { continue }
      $u = [string]$rd[0]; if ($badge.ContainsKey($u) -and $badge[$u]) { $u = $badge[$u] }
      $ty = ''
      if ($cType) {
        $raw = [string]$rd[2]
        if ($conf.kind -eq 'lumen') { $ty = if ($raw -eq '1') { 'in' } elseif ($raw -eq '2') { 'out' } else { '' } }   # Lumen: 1 in, 2 out
        else { $ty = TypeOf $raw }
      }
      $out.Add((Rec $u $t $ty))
    }
    $rd.Close()
    return $out
  } finally { $conn.Close() }
}

function Login-Api($conf) {
  $cred = (Unprotect $LoginPath) | ConvertFrom-Json
  if ($conf.kind -eq 'zkbiotime') {
    foreach ($ep in @(@('/jwt-api-token-auth/', 'JWT'), @('/api-token-auth/', 'Token'))) {
      try {
        $r = Invoke-RestMethod -Uri ($conf.source + $ep[0]) -Method Post -Body (@{ username = $cred.u; password = $cred.p } | ConvertTo-Json) -ContentType 'application/json' -TimeoutSec 20
        if ($r.token) { return @{ Authorization = ($ep[1] + ' ' + $r.token) } }
      } catch { }
    }
    throw 'הכניסה ל-BioTime נכשלה — בדקו את שם המשתמש והסיסמה'
  }
  Trust-LocalCerts
  $resp = Invoke-WebRequest -Uri ($conf.source + '/api/login') -Method Post -UseBasicParsing -TimeoutSec 20 -ContentType 'application/json' `
    -Body (@{ User = @{ login_id = $cred.u; password = $cred.p } } | ConvertTo-Json)
  $sid = $resp.Headers['bs-session-id']
  if (-not $sid) { throw 'הכניסה ל-BioStar נכשלה — בדקו את שם המשתמש והסיסמה' }
  return @{ 'bs-session-id' = $sid }
}
function Read-Api($conf, [datetime]$since) {
  $h = Login-Api $conf
  $out = New-Object Collections.Generic.List[object]
  if ($conf.kind -eq 'zkbiotime') {
    $url = $conf.source + '/iclock/api/transactions/?page_size=500&start_time=' + [uri]::EscapeDataString($since.ToString('yyyy-MM-dd HH:mm:ss'))
    $guard = 0
    while ($url -and $guard -lt 400) {
      $guard++
      $r = Invoke-RestMethod -Uri $url -Headers $h -TimeoutSec 60
      foreach ($x in $r.data) {
        $t = [datetime]::Parse([string]$x.punch_time)
        $ps = [string]$x.punch_state
        $ty = if ($ps -in @('0', '3', '4')) { 'in' } elseif ($ps -in @('1', '2', '5')) { 'out' } else { '' }
        $out.Add((Rec $x.emp_code $t $ty))
      }
      $url = $r.next
    }
    return $out
  }
  # BioStar 2: authentication-success events (verify 0x10xx, identify 0x13xx) with a user
  $body = @{ Query = @{ limit = 20000; conditions = @(@{ column = 'datetime'; operator = 3; values = @($since.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.000Z'), (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.000Z')) });
      orders = @(@{ column = 'datetime'; descending = $false }) } } | ConvertTo-Json -Depth 6
  $r = Invoke-RestMethod -Uri ($conf.source + '/api/events/search') -Method Post -Headers $h -Body $body -ContentType 'application/json' -TimeoutSec 60
  foreach ($x in $r.EventCollection.rows) {
    $code = [int]$x.event_type_id.code; $uid = [string]$x.user_id.user_id
    if (-not $uid -or -not (($code -ge 4096 -and $code -le 4127) -or ($code -ge 4864 -and $code -le 4895))) { continue }
    $out.Add((Rec $uid ([datetime]::Parse([string]$x.datetime).ToLocalTime()) ''))
  }
  return $out
}

# a line of an exported file → (employee, time, in/out): the date and time anywhere in the line, the employee number
# = the first plain number that is not part of them, in/out by a word / letter if there is one
$RX_ISO = '(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})[ T,;\t]+(\d{1,2}):(\d{2})'
$RX_DMY = '(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})[ T,;\t]+(\d{1,2}):(\d{2})'
function Parse-Line([string]$line) {
  $m = [regex]::Match($line, $RX_ISO); $iso = $true
  if (-not $m.Success) { $m = [regex]::Match($line, $RX_DMY); $iso = $false }
  if (-not $m.Success) { return $null }
  try {
    if ($iso) { $t = Get-Date -Year $m.Groups[1].Value -Month $m.Groups[2].Value -Day $m.Groups[3].Value -Hour $m.Groups[4].Value -Minute $m.Groups[5].Value -Second 0 }
    else { $y = [int]$m.Groups[3].Value; if ($y -lt 100) { $y += 2000 }; $t = Get-Date -Year $y -Month $m.Groups[2].Value -Day $m.Groups[1].Value -Hour $m.Groups[4].Value -Minute $m.Groups[5].Value -Second 0 }
  } catch { return $null }
  $rest = $line.Remove($m.Index, $m.Length)
  $fields = $rest -split '[\t,;]|\s{2,}' | ForEach-Object { $_.Trim().Trim('"') } | Where-Object { $_ -ne '' }
  $emp = $fields | Where-Object { $_ -match '^\d{1,12}$' } | Select-Object -First 1
  if (-not $emp) { return $null }
  $ty = ''; foreach ($f in $fields) { $x = TypeOf $f; if ($x) { $ty = $x; break } }
  return (Rec $emp $t $ty)
}
function Read-Folder($conf, [datetime]$since) {
  if (-not (Test-Path -LiteralPath $conf.source)) { throw ('התיקייה לא נמצאה: ' + $conf.source) }
  $out = New-Object Collections.Generic.List[object]; $raw = New-Object Text.StringBuilder
  $files = Get-ChildItem -LiteralPath $conf.source -File -ErrorAction SilentlyContinue | Where-Object { $_.Extension -imatch '^\.(csv|txt|dat|log)$' -and $_.LastWriteTime -ge $since.AddDays(-2) }
  foreach ($f in $files) {
    foreach ($line in [IO.File]::ReadAllLines($f.FullName)) {
      $l = $line.Trim(); if (-not $l) { continue }
      # Synel's fixed-width DAT lines (…B / …E at the end) — the server reads them as they are
      if ($l.Length -ge 30 -and $l -match '[BE]$' -and $l -notmatch '[,;\t]') { [void]$raw.AppendLine($l); continue }
      $r = Parse-Line $l; if ($r -and $r.at -ge $since) { $out.Add($r) }
    }
  }
  return @{ recs = $out; text = $raw.ToString() }
}

function Do-Sync([int]$days) {
  $conf = Get-Content -LiteralPath $ConfPath -Raw -Encoding UTF8 | ConvertFrom-Json
  $key = Unprotect $KeyPath
  $since = (Get-Date).Date.AddDays(-[Math]::Max(1, $days))
  $text = ''
  switch ($conf.method) {
    'mdb' { $recs = Read-Mdb $conf $since }
    'api' { $recs = Read-Api $conf $since }
    default { $r = Read-Folder $conf $since; $recs = $r.recs; $text = $r.text }
  }
  # in / out unknown → in turn within each employee's day (first in, then out, …)
  $list = @($recs | Where-Object { $_.emp } | Sort-Object emp, at)
  $prev = ''; $n = 0
  foreach ($r in $list) {
    $k = $r.emp + '|' + $r.at.ToString('yyyy-MM-dd')
    if ($k -ne $prev) { $prev = $k; $n = 0 }
    if (-not $r.type) { $r.type = if ($n % 2 -eq 0) { 'in' } else { 'out' } }
    $n++
  }
  $records = @($list | ForEach-Object { @{ clockEmpNo = $_.emp; date = $_.at.ToString('yyyy-MM-dd'); time = $_.at.ToString('HH:mm'); type = $(if ($_.type -eq 'out') { $TYPE_OUT } else { $TYPE_IN }) } })
  $sent = 0; $unmapped = @()
  for ($i = 0; $i -lt $records.Count; $i += 2000) {
    $chunk = $records[$i..([Math]::Min($i + 1999, $records.Count - 1))]
    $resp = Post @{ action = 'importAttendanceDat'; clockKey = $key; records = @($chunk); sourceLabel = ('מחשב השעון (' + $conf.label + ')') }
    if (-not $resp.ok) { throw ('השרת: ' + $resp.error) }
    $sent += $chunk.Count; if ($resp.unmapped) { $unmapped += @($resp.unmapped) }
  }
  if ($text) {
    $resp = Post @{ action = 'importAttendanceDat'; clockKey = $key; text = $text; sourceLabel = ('מחשב השעון (' + $conf.label + ')') }
    if (-not $resp.ok) { throw ('השרת: ' + $resp.error) }
    $sent += ($text -split "`n" | Where-Object { $_.Trim() }).Count
  }
  $msg = 'נשלחו ' + $sent + ' החתמות'
  $un = @($unmapped | ForEach-Object { $_.clockEmpNo } | Select-Object -Unique)
  if ($un.Count) { $msg += ' · מספרי שעון בלי עובד במערכת: ' + (($un | Select-Object -First 8) -join ', ') }
  return @{ ok = $true; sent = $sent; message = $msg; key = $key }
}

# ======================= -Sync (the scheduled task) =======================
if ($Sync) {
  $key = $null
  try {
    $res = Do-Sync $(if ($Days -gt 0) { $Days } else { 3 })
    Log ('OK ' + $res.message)
    try { Post @{ action = 'clockStatus'; clockKey = $res.key; ok = $true; message = $res.message; sent = $res.sent; version = $Version } | Out-Null } catch { }
    @{ ok = $true; message = $res.message } | ConvertTo-Json | Set-Content -LiteralPath $ResultPath -Encoding UTF8
  } catch {
    $err = $_.Exception.Message
    Log ('ERROR ' + $err)
    try { Post @{ action = 'clockStatus'; clockKey = (Unprotect $KeyPath); ok = $false; message = $err; version = $Version } | Out-Null } catch { }
    @{ ok = $false; message = $err } | ConvertTo-Json | Set-Content -LiteralPath $ResultPath -Encoding UTF8
  }
  return
}

# ======================= the setup window =======================
Add-Type -AssemblyName System.Windows.Forms, System.Drawing
[Windows.Forms.Application]::EnableVisualStyles()
$method = $METHOD[$Kind]
$font = New-Object Drawing.Font('Segoe UI', 10)
$f = New-Object Windows.Forms.Form
$f.Text = 'חיבור שעון הנוכחות — ' + $Product
$f.RightToLeft = 'Yes'; $f.RightToLeftLayout = $true; $f.Font = $font
$f.ClientSize = New-Object Drawing.Size(600, 470); $f.StartPosition = 'CenterScreen'; $f.FormBorderStyle = 'FixedDialog'; $f.MaximizeBox = $false
function L($text, $x, $y, $w, $h, $bold) { $l = New-Object Windows.Forms.Label; $l.Text = $text; $l.Location = New-Object Drawing.Point($x, $y); $l.Size = New-Object Drawing.Size($w, $h); if ($bold) { $l.Font = New-Object Drawing.Font('Segoe UI', 11, [Drawing.FontStyle]::Bold) }; $f.Controls.Add($l); return $l }
function T($x, $y, $w, $pw) { $t = New-Object Windows.Forms.TextBox; $t.Location = New-Object Drawing.Point($x, $y); $t.Size = New-Object Drawing.Size($w, 26); if ($pw) { $t.UseSystemPasswordChar = $true }; $f.Controls.Add($t); return $t }
function B($text, $x, $y, $w) { $b = New-Object Windows.Forms.Button; $b.Text = $text; $b.Location = New-Object Drawing.Point($x, $y); $b.Size = New-Object Drawing.Size($w, 34); $f.Controls.Add($b); return $b }

L ('חיבור שעון הנוכחות ל' + $Product) 20 15 560 26 $true | Out-Null
L ('הדגם שנבחר: ' + $KindLabel) 20 45 560 22 $false | Out-Null
$lblFind = L 'מחפש את תוכנת השעון במחשב…' 20 80 560 44 $false
$srcLabel = if ($method -eq 'mdb') { 'קובץ הנתונים של התוכנה:' } elseif ($method -eq 'api') { 'כתובת שרת התוכנה:' } else { 'התיקייה שאליה התוכנה מייצאת את הנוכחות:' }
L $srcLabel 20 128 560 22 $false | Out-Null
$txtSrc = T 120 152 460 $false
$btnPick = B 'בחירה…' 20 149 90
$lblU = $null; $txtU = $null; $txtP = $null
if ($method -eq 'api') {
  L 'שם המשתמש והסיסמה שלכם בתוכנת השעון (נשמרים מוצפנים במחשב הזה בלבד):' 20 192 560 22 $false | Out-Null
  L 'שם משתמש' 470 220 110 22 $false | Out-Null; $txtU = T 270 218 190 $false
  L 'סיסמה' 470 252 110 22 $false | Out-Null; $txtP = T 270 250 190 $true
}
$lblMsg = L '' 20 290 560 110 $false
$btnGo = B 'חיבור והפעלה' 400 415 180
$btnClose = B 'סגירה' 20 415 120
$btnClose.Add_Click({ $f.Close() })

$btnPick.Add_Click({
  if ($method -eq 'mdb') {
    $d = New-Object Windows.Forms.OpenFileDialog; $d.Filter = 'Access (*.mdb;*.accdb)|*.mdb;*.accdb|כל הקבצים|*.*'; $d.Title = 'בחירת קובץ הנתונים של תוכנת השעון'
    if ($d.ShowDialog() -eq 'OK') { $txtSrc.Text = $d.FileName }
  } elseif ($method -eq 'folder') {
    $d = New-Object Windows.Forms.FolderBrowserDialog; $d.Description = 'בחירת התיקייה שאליה תוכנת השעון שומרת את קבצי הנוכחות'
    if ($d.ShowDialog() -eq 'OK') { $txtSrc.Text = $d.SelectedPath }
  } else {
    [Windows.Forms.MessageBox]::Show('כותבים בשדה את כתובת השרת, כפי שהיא מופיעה בדפדפן כשנכנסים לתוכנה (למשל http://192.168.1.20:8081).', 'כתובת השרת', 'OK', 'Information', 'Button1', 'RtlReading') | Out-Null
  }
})

$f.Add_Shown({
  $f.Refresh()
  $found = $null; try { $found = Find-Source $Kind } catch { }
  if ($found) {
    $txtSrc.Text = $found
    $lblFind.Text = '✅ נמצאה התקנה. אם זה לא המיקום הנכון — לוחצים "בחירה…".'
    $lblFind.ForeColor = [Drawing.Color]::DarkGreen
  } else {
    $lblFind.Text = '⚠ לא זוהתה התקנה במקום הרגיל. ' + $(if ($method -eq 'api') { 'כתבו את כתובת השרת הקיים.' } elseif ($method -eq 'folder') { 'בחרו את התיקייה הקיימת.' } else { 'בחרו את המיקום הקיים של קובץ הנתונים.' })
    $lblFind.ForeColor = [Drawing.Color]::DarkOrange
  }
})

$script:done = $false
$btnGo.Add_Click({
  if ($script:done) { $f.Close(); return }
  $btnGo.Enabled = $false; $lblMsg.ForeColor = [Drawing.Color]::Black
  try {
    $src = $txtSrc.Text.Trim().TrimEnd('/')
    if (-not $src) { throw 'לא נבחר מיקום — לוחצים "בחירה…"' }
    if ($method -ne 'api' -and -not (Test-Path -LiteralPath $src)) { throw 'המיקום שנבחר לא קיים' }
    if ($method -eq 'api' -and $src -notmatch '^https?://') { $src = 'http://' + $src }
    New-Item -ItemType Directory -Force $Dir | Out-Null
    if ($method -eq 'api') {
      if (-not $txtU.Text -or -not $txtP.Text) { throw 'יש למלא שם משתמש וסיסמה של תוכנת השעון' }
      [IO.File]::WriteAllBytes($LoginPath, (Protect (@{ u = $txtU.Text; p = $txtP.Text } | ConvertTo-Json)))
      $lblMsg.Text = 'בודק את הכניסה לתוכנה…'; $f.Refresh()
      Login-Api @{ kind = $Kind; source = $src } | Out-Null
    }
    $refresh = ''
    if ($Kind -eq 'lumen') { $b = Join-Path (Split-Path $src) 'auto.bat'; if (Test-Path $b) { $refresh = $b } }
    # this computer's own key: only its SHA-256 goes to the server
    $lblMsg.Text = 'מחבר את המחשב למערכת…'; $f.Refresh()
    $bytes = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $key = [Convert]::ToBase64String($bytes)
    $hash = -join ([Security.Cryptography.SHA256]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes($key)) | ForEach-Object { $_.ToString('x2') })
    $r = Post @{ action = 'clockPair'; pairCode = $PairCode; keyHash = $hash; kind = $Kind; computer = $env:COMPUTERNAME; source = $src }
    if (-not $r.ok) { throw $r.error }
    [IO.File]::WriteAllBytes($KeyPath, (Protect $key))
    @{ kind = $Kind; label = $KindLabel; method = $method; source = $src; refresh = $refresh } | ConvertTo-Json | Set-Content -LiteralPath $ConfPath -Encoding UTF8
    # the sync, every 10 minutes, hidden — Access files need the 32-bit PowerShell
    $script = Join-Path $Dir 'clock.ps1'
    $self = [IO.File]::ReadAllText($PSCommandPath)
    [IO.File]::WriteAllText($script, $self, (New-Object Text.UTF8Encoding $true))
    $ps = if ($method -eq 'mdb' -and (Test-Path "$env:WINDIR\SysWOW64\WindowsPowerShell\v1.0\powershell.exe")) { "$env:WINDIR\SysWOW64\WindowsPowerShell\v1.0\powershell.exe" } else { "$env:WINDIR\System32\WindowsPowerShell\v1.0\powershell.exe" }
    $vbs = Join-Path $Dir 'run.vbs'
    $q = '"'
    Set-Content -LiteralPath $vbs -Encoding ASCII -Value ('CreateObject("WScript.Shell").Run ' + $q + $q + $q + $ps + $q + $q + ' -NoProfile -ExecutionPolicy Bypass -File ' + $q + $q + $script + $q + $q + ' -Sync' + $q + ', 0, False')
    $lblMsg.Text = 'מגדיר סנכרון אוטומטי כל 10 דקות…'; $f.Refresh()
    $act = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument ('"' + $vbs + '"')
    $trg = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 10)
    $logon = New-ScheduledTaskTrigger -AtLogOn -User ($env:USERDOMAIN + '\' + $env:USERNAME)
    $set = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 9)
    $pr = New-ScheduledTaskPrincipal -UserId ($env:USERDOMAIN + '\' + $env:USERNAME) -LogonType Interactive -RunLevel Limited
    Register-ScheduledTask -TaskName $TaskName -Action $act -Trigger @($trg, $logon) -Settings $set -Principal $pr -Force | Out-Null
    # a first sync now — the last 31 days
    $lblMsg.Text = 'מסנכרן בפעם הראשונה (החודש האחרון)…'; $f.Refresh()
    Remove-Item -LiteralPath $ResultPath -ErrorAction SilentlyContinue
    Start-Process -FilePath $ps -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ('"' + $script + '"'), '-Sync', '-Days', '31') -WindowStyle Hidden -Wait
    $res = if (Test-Path $ResultPath) { Get-Content -LiteralPath $ResultPath -Raw -Encoding UTF8 | ConvertFrom-Json } else { @{ ok = $false; message = 'הסנכרון לא החזיר תשובה' } }
    if ($res.ok) {
      $lblMsg.ForeColor = [Drawing.Color]::DarkGreen
      $lblMsg.Text = "✅ השעון מחובר!`n" + $res.message + "`nמעכשיו הנוכחות נשלחת למערכת כל 10 דקות, כשהמחשב דולק ומחובר. אפשר לסגור את החלון."
      $btnGo.Text = 'סיום'; $btnGo.Enabled = $true; $script:done = $true
    } else {
      throw ('החיבור נוצר, אבל הסנכרון הראשון נכשל: ' + $res.message)
    }
  } catch {
    $lblMsg.ForeColor = [Drawing.Color]::DarkRed
    $lblMsg.Text = '⚠ ' + $_.Exception.Message
    $btnGo.Enabled = $true
  }
})
[void]$f.ShowDialog()
