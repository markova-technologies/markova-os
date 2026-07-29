-- ai_agent_handler.lua
-- Bridges FreeSWITCH calls to FastAPI TwiML backend (Windows Compatible)
-- Uses system curl for reliable HTTP communication

session:answer()

local backend_url = "https://markova-ai-backend.onrender.com"
local uuid = session:get_uuid()
local caller_id = session:getVariable("caller_id_number") or "sip-user"

-- Windows-compatible temp directory
local temp_dir = os.getenv("TEMP") or "C:\\Temp"

local function now_ms()
    local ok, value = pcall(freeswitch.getTime)
    if ok and value then
        return math.floor(value / 1000)
    end
    return os.time() * 1000
end

local function is_valid_wav(path)
    local f = io.open(path, "rb")
    if not f then return false end
    local header = f:read(12)
    local size = f:seek("end") or 0
    f:close()
    return size > 100 and header and
        string.sub(header, 1, 4) == "RIFF" and
        string.sub(header, 9, 12) == "WAVE"
end

-- === CRITICAL: Disable all RTP/media/SIP timeouts ===
-- Without these, the call drops during HTTP processing (Whisper + LLM takes 5-15s)
session:setVariable("rtp_timeout_sec", "0")
session:setVariable("rtp_hold_timeout_sec", "0")
session:setVariable("media_timeout", "0")
session:setVariable("sip_session_expires", "0")
session:setVariable("minimum_session_expires", "0")
-- Tell FreeSWITCH to refuse session timer negotiation from the client (MicroSIP)
session:setVariable("sip_enable_soa", "true")
session:setVariable("sip_force_expires", "0")
session:setVariable("jitterbuffer_msec", "60:200:20")

freeswitch.consoleLog("info", "[AI Agent] === CALL STARTED === UUID: " .. uuid .. "\n")
freeswitch.consoleLog("info", "[AI Agent] Caller: " .. caller_id .. "\n")
freeswitch.consoleLog("info", "[AI Agent] Temp dir: " .. temp_dir .. "\n")

-- Make HTTP POST using system curl (reliable on Windows)
function http_post(endpoint, post_data)
    local url = backend_url .. endpoint
    freeswitch.consoleLog("info", "[AI Agent] POST " .. url .. "\n")
    
    local cmd = string.format(
        'curl.exe -s --connect-timeout 10 --max-time 90 -X POST "%s" -d "%s"',
        url, post_data
    )
    
    local handle = io.popen(cmd)
    local response = ""
    if handle then
        response = handle:read("*a")
        handle:close()
    end
    
    freeswitch.consoleLog("info", "[AI Agent] Response (" .. #response .. " bytes): " .. string.sub(response, 1, 200) .. "\n")
    return response
end

-- Upload audio file via system curl
function upload_audio(filepath)
    local url = backend_url .. "/handle-input"
    freeswitch.consoleLog("info", "[AI Agent] Uploading audio: " .. filepath .. " to " .. url .. "\n")
    
    local cmd = string.format(
        'curl.exe -s --connect-timeout 10 --max-time 90 -X POST "%s" -F "AudioFile=@%s" -F "CallSid=%s"',
        url, filepath, uuid
    )
    
    local handle = io.popen(cmd)
    local response = ""
    if handle then
        response = handle:read("*a")
        handle:close()
    end
    
    freeswitch.consoleLog("info", "[AI Agent] Upload response (" .. #response .. " bytes): " .. string.sub(response, 1, 200) .. "\n")
    return response
end

-- Rewrite remote URLs to localhost (both run on same machine)
function fix_audio_url(url)
    local fixed = url:gsub("https?://[^/]+/audio/", backend_url .. "/audio/")
    if fixed ~= url then
        freeswitch.consoleLog("info", "[AI Agent] URL rewritten: " .. url .. " -> " .. fixed .. "\n")
    end
    return fixed
end

-- Download audio file to local disk for playback (avoids needing mod_shout)
function download_audio(url, target_file)
    local download_started = now_ms()
    -- Detect file extension from URL (default to .wav for FreeSWITCH compatibility)
    local ext = string.match(url, "%.(%w+)$") or "wav"
    if ext ~= "wav" then
        ext = "wav"  -- Force WAV for FreeSWITCH compatibility
    end
    local local_file = target_file or (temp_dir .. "\\ai_response_" .. uuid .. "." .. ext)
    local cmd = string.format('curl.exe -s --connect-timeout 10 --max-time 90 --compressed --tcp-nodelay -o "%s" "%s"', local_file, url)
    freeswitch.consoleLog("info", "[AI Agent] Downloading: " .. url .. " -> " .. local_file .. "\n")
    os.execute(cmd)
    
    -- Verify file exists and has content
    local f = io.open(local_file, "r")
    if f then
        local size = f:seek("end")
        f:close()
        if size > 100 then
            freeswitch.consoleLog(
                "info",
                "[AI Agent] Downloaded " .. size .. " bytes in " ..
                (now_ms() - download_started) .. "ms\n"
            )
            return local_file
        end
    end
    freeswitch.consoleLog("err", "[AI Agent] Download failed or empty file\n")
    return nil
end

-- Parse TwiML and play audio or speak text
function parse_and_play(xml)
    if not xml or xml == "" then
        freeswitch.consoleLog("err", "[AI Agent] Empty XML!\n")
        return false
    end

    -- Look for <Play> tag (AI-generated audio URL)
    local play_url = string.match(xml, "<Play>(.-)</Play>")
    if play_url then
        -- Fix relative URLs
        if string.sub(play_url, 1, 1) == "/" then
            play_url = backend_url .. play_url
        end
        
        -- Rewrite ngrok/remote URLs to localhost
        play_url = fix_audio_url(play_url)
        
        -- Download to local file first (no mod_shout needed!)
        local local_file = download_audio(play_url)
        if local_file then
            freeswitch.consoleLog("info", "[AI Agent] PLAYING LOCAL FILE: " .. local_file .. "\n")
            session:execute("playback", local_file)
            os.remove(local_file)  -- cleanup
            return true
        else
            freeswitch.consoleLog("err", "[AI Agent] Could not download audio!\n")
        end
    end
    
    -- Fallback: <Say> tag
    local say_text = string.match(xml, "<Say.->(.-)</Say>")
    if say_text then
        freeswitch.consoleLog("info", "[AI Agent] SAY text (no TTS available): " .. say_text .. "\n")
        -- flite may not be installed, just log it
        return false
    end
    
    freeswitch.consoleLog("warning", "[AI Agent] No Play or Say found in XML\n")
    return false
end


-- === HELPER: Play audio (VMD barge-in handled by Python ESL) ===
-- Python ESL (barge_in_manager.py) watches CHANNEL_EXECUTE events:
--   When playback starts → ESL calls uuid_execute <uuid> vmd start
--   When vmd::start fires → ESL calls uuid_break to stop playback
-- Lua does nothing special here — just plain playback.
function play_with_barge_in(local_file, keep_file)
    if not local_file or not session:ready() then return false end
    local playback_started = now_ms()
    freeswitch.consoleLog("info", "[AI Agent] PLAYING: " .. local_file .. "\n")
    session:execute("playback", local_file)
    if not keep_file then
        pcall(function() os.remove(local_file) end)
    end
    freeswitch.consoleLog(
        "info",
        "[AI Agent] Playback done in " .. (now_ms() - playback_started) .. "ms\n"
    )
    return false
end


-- === HELPER: Direct SIP response ===
-- The backend returns the generated WAV in the upload response, avoiding a
-- second HTTPS connection and download before playback can begin.
function stream_response(rec_file)
    local backend_started = now_ms()
    local url = backend_url .. "/sip-response"
    local out_file = temp_dir .. "\\ai_response_" .. uuid .. ".wav"
    local header_file = temp_dir .. "\\ai_response_" .. uuid .. ".headers"
    pcall(function() os.remove(out_file) end)
    pcall(function() os.remove(header_file) end)
    local cmd = string.format(
        'curl.exe -s --compressed --tcp-nodelay -D "%s" -X POST "%s" -F "audio_file=@%s;type=audio/wav" -F "call_id=%s" -F "caller_id=%s" -o "%s" --connect-timeout 10 --max-time 90',
        header_file, url, rec_file, uuid, caller_id, out_file
    )
    freeswitch.consoleLog("info", "[AI Agent] Calling /sip-response...\n")
    os.execute(cmd)
    freeswitch.consoleLog(
        "info",
        "[AI Agent] Backend audio returned in " ..
        (now_ms() - backend_started) .. "ms\n"
    )

    if not is_valid_wav(out_file) then
        pcall(function() os.remove(out_file) end)
        pcall(function() os.remove(header_file) end)
        freeswitch.consoleLog("warning", "[AI Agent] SIP response was not a valid WAV\n")
        return false, false
    end

    local should_end_call = false
    local headers = io.open(header_file, "r")
    if headers then
        local header_text = string.lower(headers:read("*a") or "")
        headers:close()
        should_end_call = string.find(
            header_text,
            "x%-end%-call:%s*true"
        ) ~= nil
    end
    pcall(function() os.remove(header_file) end)

    freeswitch.consoleLog("info", "[AI Agent] Playing direct SIP response\n")
    play_with_barge_in(out_file)
    return true, should_end_call
end

-- === HELPER: Wake the backend without blocking the call ===
-- The host suspends idle free-tier instances, so the first request of a call
-- can pay a ~30 second cold start. Because the greeting is served from a local
-- cache, nothing would otherwise touch the backend until the caller has already
-- finished speaking. Dispatching a detached request here lets the wake-up
-- overlap the greeting playback instead of the caller's first answer.
function warm_backend()
    local cmd = string.format('start /B "" curl.exe -s -m 45 -o NUL "%s/"', backend_url)
    os.execute(cmd)
    freeswitch.consoleLog("info", "[AI Agent] Backend warm-up dispatched\n")
end

-- === MAIN CONVERSATION FLOW ===

warm_backend()

-- 1. Cache the static greeting locally. Repeat calls avoid both the greeting
-- endpoint and audio download, while invalid/non-WAV cache entries self-heal.
local greeting_cache = temp_dir .. "\\markova_shop_greeting_8k.wav"
if is_valid_wav(greeting_cache) then
    freeswitch.consoleLog("info", "[AI Agent] Greeting cache hit\n")
    play_with_barge_in(greeting_cache, true)
else
    pcall(function() os.remove(greeting_cache) end)
    local greeting_started = now_ms()
    freeswitch.consoleLog("info", "[AI Agent] Greeting cache miss; fetching greeting...\n")
    local greeting = http_post("/incoming-call", "From=" .. caller_id .. "&CallSid=" .. uuid)
    local greeting_file_url = string.match(greeting, "<Play>(.-)</Play>")
    if greeting_file_url then
        if string.sub(greeting_file_url, 1, 1) == "/" then
            greeting_file_url = backend_url .. greeting_file_url
        end
        greeting_file_url = fix_audio_url(greeting_file_url)
        local local_greeting = download_audio(greeting_file_url, greeting_cache)
        if local_greeting and is_valid_wav(local_greeting) then
            freeswitch.consoleLog(
                "info",
                "[AI Agent] Greeting ready in " ..
                (now_ms() - greeting_started) .. "ms\n"
            )
            play_with_barge_in(local_greeting, true)
        else
            pcall(function() os.remove(greeting_cache) end)
            freeswitch.consoleLog("err", "[AI Agent] Greeting download was not a valid WAV\n")
        end
    end
end

-- 2. Streaming conversation loop with barge-in
local max_turns = 20
for turn = 1, max_turns do
    if not session:ready() then
        freeswitch.consoleLog("info", "[AI Agent] Caller hung up at turn " .. turn .. "\n")
        break
    end

    -- Record user's voice at 16kHz for best Whisper quality
    local rec_file = temp_dir .. "\\fs_recording_" .. uuid .. ".wav"
    freeswitch.consoleLog("info", "[AI Agent] Turn " .. turn .. " - Listening...\n")

    session:setVariable("record_sample_rate", "16000")
    session:setVariable("enable_file_write_buffering", "false")

    -- Stop after one second below the speech-energy threshold instead of
    -- waiting near the 10-second maximum after the caller finishes speaking.
    local record_started = now_ms()
    session:execute("record", rec_file .. " 10 200 1")
    freeswitch.consoleLog(
        "info",
        "[AI Agent] Recording stage took " ..
        (now_ms() - record_started) .. "ms\n"
    )

    if not session:ready() then break end

    -- Check recording has audio
    local f = io.open(rec_file, "r")
    if f then
        local size = f:seek("end")
        f:close()
        freeswitch.consoleLog("info", "[AI Agent] Recording: " .. size .. " bytes\n")

        if size > 1000 then
            -- Stage 4: Stream response sentence-by-sentence with barge-in (Stage 3)
            local turn_backend_started = now_ms()
            local ok, should_end_call = stream_response(rec_file)
            freeswitch.consoleLog(
                "info",
                "[AI Agent] Turn " .. turn .. " backend/playback stage took " ..
                (now_ms() - turn_backend_started) .. "ms\n"
            )
            if not ok then
                -- Fallback to batch /handle-input if streaming fails
                freeswitch.consoleLog("warning", "[AI Agent] Stream failed, falling back to batch mode\n")
                local response = upload_audio(rec_file)
                if not session:ready() then
                    os.remove(rec_file)
                    break
                end
                parse_and_play(response)
            end
            if should_end_call then
                freeswitch.consoleLog("info", "[AI Agent] Farewell completed; ending call\n")
                os.remove(rec_file)
                break
            end
        else
            freeswitch.consoleLog("info", "[AI Agent] Recording too small, silence\n")
        end

        os.remove(rec_file)
    else
        freeswitch.consoleLog("err", "[AI Agent] Recording file not found!\n")
    end
end

freeswitch.consoleLog("info", "[AI Agent] === CALL ENDED === UUID: " .. uuid .. "\n")
if session:ready() then
    session:hangup()
end
