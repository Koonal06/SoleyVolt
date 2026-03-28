$ErrorActionPreference = "Stop"

$projectRef = if ($env:SUPABASE_PROJECT_REF) { $env:SUPABASE_PROJECT_REF } else { "itaykvdfwqfoatqchyzs" }
$supabaseToken = $env:SUPABASE_ACCESS_TOKEN
$dbPassword = $env:SUPABASE_DB_PASSWORD
$dbUrl = $env:SUPABASE_DB_URL

if (-not $supabaseToken) {
  throw "SUPABASE_ACCESS_TOKEN is required."
}

if (-not $dbPassword -and -not $dbUrl) {
  throw "Set either SUPABASE_DB_PASSWORD or SUPABASE_DB_URL before deploying."
}

$env:SUPABASE_ACCESS_TOKEN = $supabaseToken

$supabaseArgs = @("supabase")

if ($dbUrl) {
  Write-Host "Pushing migrations with direct database URL..."
  & npx.cmd @supabaseArgs "db" "push" "--db-url" $dbUrl
} else {
  Write-Host "Linking local project to Supabase project $projectRef..."
  & npx.cmd @supabaseArgs "link" "--project-ref" $projectRef "--password" $dbPassword

  Write-Host "Pushing migrations to linked project..."
  & npx.cmd @supabaseArgs "db" "push" "--linked"
}

Write-Host "Deploying server Edge Function..."
& npx.cmd @supabaseArgs "functions" "deploy" "server" "--project-ref" $projectRef

Write-Host "Deployment completed."
