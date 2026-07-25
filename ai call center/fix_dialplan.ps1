# Fix FreeSWITCH dialplan to correctly route extension 8000 to the AI agent
# Run this as Administrator in PowerShell

$file = 'C:\Program Files\FreeSWITCH\conf\dialplan\default.xml'
$content = Get-Content $file -Raw

Write-Host "Original file loaded. Size: $($content.Length) characters"

# Fix 1: The AI agent extension still targets 9000 instead of 8000
# Replace the old ai_agent rule with the correct 8000 rule
$content = $content -replace '(?s)<!-- MARKOVA AI Agent.*?</extension>', @'
    <!-- GM Furniture AI Agent (Almaz) - Amharic AI Customer Service -->
    <extension name="ai_agent">
      <condition field="destination_number" expression="^8000$">
        <action application="answer"/>
        <action application="sleep" data="500"/>
        <action application="lua" data="ai_agent_handler.lua"/>
        <action application="hangup"/>
      </condition>
    </extension>
'@

Write-Host "Fix 1 complete: AI agent now targets 8000"

# Fix 2: Change del-group regex to not match 8000
# The pattern ^80(\d{2})$ matches 8000 (80+00). Change to ^80([1-9]\d)$ so it only matches 8001-8099
$content = $content -replace [regex]::Escape('expression="^80(\d{2})$"'), 'expression="^80([1-9]\d)$"'

Write-Host "Fix 2 complete: del-group regex won't match 8000 anymore"

# Write the changes back
Set-Content $file $content -Encoding UTF8
Write-Host "SUCCESS: Dialplan saved. Now run 'reloadxml' in FreeSWITCH console."
