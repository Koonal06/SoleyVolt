$required = @(
  "SUPABASE_MANAGEMENT_TOKEN",
  "SUPABASE_PROJECT_REF",
  "SUPABASE_SMTP_FROM",
  "SUPABASE_SMTP_HOST",
  "SUPABASE_SMTP_PORT",
  "SUPABASE_SMTP_USER",
  "SUPABASE_SMTP_PASS",
  "SUPABASE_SMTP_SENDER_NAME"
)

$missing = $required | Where-Object { -not $env:$_ }

if ($missing.Count -gt 0) {
  throw "Missing required environment variables: $($missing -join ', ')"
}

$headers = @{
  Authorization = "Bearer $($env:SUPABASE_MANAGEMENT_TOKEN)"
  "Content-Type" = "application/json"
}

$body = @{
  external_email_enabled = $true
  mailer_secure_email_change_enabled = $true
  mailer_autoconfirm = $false
  smtp_admin_email = $env:SUPABASE_SMTP_FROM
  smtp_host = $env:SUPABASE_SMTP_HOST
  smtp_port = [int]$env:SUPABASE_SMTP_PORT
  smtp_user = $env:SUPABASE_SMTP_USER
  smtp_pass = $env:SUPABASE_SMTP_PASS
  smtp_sender_name = $env:SUPABASE_SMTP_SENDER_NAME
} | ConvertTo-Json

$url = "https://api.supabase.com/v1/projects/$($env:SUPABASE_PROJECT_REF)/config/auth"

Invoke-RestMethod -Method Patch -Uri $url -Headers $headers -Body $body
