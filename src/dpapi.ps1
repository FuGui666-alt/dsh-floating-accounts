param([ValidateSet('protect','unprotect')][string]$Operation)
$ErrorActionPreference = 'Stop'
$bytes = $null
$result = $null
try {
  Add-Type -AssemblyName System.Security
  $text = [Console]::In.ReadToEnd()
  $bytes = [Convert]::FromBase64String($text.Trim())
  $entropy = [Text.Encoding]::UTF8.GetBytes('dsh-floating-accounts/v1')
  $scope = [Security.Cryptography.DataProtectionScope]::CurrentUser
  if ($Operation -eq 'protect') {
    $result = [Security.Cryptography.ProtectedData]::Protect($bytes, $entropy, $scope)
  } else {
    $result = [Security.Cryptography.ProtectedData]::Unprotect($bytes, $entropy, $scope)
  }
  [Console]::Out.Write([Convert]::ToBase64String($result))
  exit 0
} catch {
  [Console]::Error.Write('DPAPI operation failed')
  exit 1
} finally {
  # Byte arrays can be cleared; managed and JavaScript immutable strings cannot be guaranteed erased.
  if ($null -ne $bytes) { [Array]::Clear($bytes, 0, $bytes.Length) }
  if ($null -ne $result) { [Array]::Clear($result, 0, $result.Length) }
}