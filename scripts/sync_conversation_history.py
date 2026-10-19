"""
Markova OS & Antigravity IDE - Permanent Conversation History Sync & Recovery Tool
================================================================================
Scans all conversations on disk, builds lossless Protobuf summaries, writes
permanent JSON fallback and updates state.vscdb.
"""

import sqlite3, os, base64, json, re, sys

conv_dir = r"C:\Users\zelal\.gemini\antigravity-ide\conversations"
brain_dir = r"C:\Users\zelal\.gemini\antigravity-ide\brain"
db_path = r"C:\Users\zelal\AppData\Roaming\Antigravity IDE\User\globalStorage\state.vscdb"
permanent_json_path = r"C:\Users\zelal\.gemini\antigravity-ide\permanent_trajectory_summaries.json"

CUSTOM_TITLES = {
    "42731b34-a3a3-47ad-8f7d-035834ecddcb": ("Markova AI Call Center: Full Platform Architecture & Implementation", "Markova AI Call Center: Dual-Environment, Speech-to-Speech Almaz Engine, Supabase Auth & Multi-Tenant Deployment"),
    "18f9f6e9-61f7-488a-bc23-19902f9c8b0b": ("Markova AI Call Center: Orchestrator & Live Voice Turn Processing", "Markova AI Call Center: Real-time Audio Streaming, Homophone Normalizer & FreeSWITCH SIP Integration"),
    "99373e22-b4d3-4797-8fb3-f2ea1902a07d": ("Markova AI Call Center: Workspace Tagging & Architecture", "Markova AI Call Center: Workspace Organization, Session State & Platform Architecture"),
    "a51afa98-bdf2-450b-ab41-f3e47661995b": ("Markova AI Call Center: Voice Pipeline Optimization", "Markova AI Call Center: Processing Voice Turns, BullMQ Worker Loop & Latency Reduction"),
    "fdddab2a-a551-4bb1-b135-3d433147d7a9": ("Markova AI Voice Engine & TTS Benchmark", "Markova AI: Natural Amharic Voice Benchmarks, Edge TTS & FreeSWITCH Bridges"),
    "f0d9c8e0-200b-4c58-af76-eab2e8163b3d": ("Markova AI Call Center: History Recovery & Session Continuity", "Markova AI Call Center: Conversation History Recovery, Memory Anchors & CTO Briefing"),
    "6e50a61a-a2a2-4744-bdc1-3c2f14f26c49": ("Markova AI: Git Repository Disconnect & Security Remediation", "Markova AI: Disconnecting External Git Remotes and Hardening Repository Security"),
    "05eca675-0302-4686-bbb2-81ba08e6dc39": ("Markova AI Call Center: Setup & Conversation History", "Markova AI Call Center: System Setup, Workspace Initialization and Conversation Continuity"),
    "e444d9e5-72fe-4b11-b254-cbe817b789de": ("Markova OS: Git Setup & Architecture Roadmap", "Markova OS: Git Initialization, Branch Setup and Architecture Roadmap"),
    "aeb6507c-7365-4cd3-af6a-aea370d6475d": ("Markova AI: Project Walkthrough & System Architecture", "Markova AI Call Center: Deep Architectural Walkthrough and Core Engine Analysis"),
    "bd3d98dd-818a-4f71-8f7f-feb839dc7d66": ("Markova AI: Conversation Workspace Tagging Continuation", "Markova AI: Continuing Workspace Alignment and Multi-Project Tagging"),
    "8fa2214e-409c-4696-b082-dfeb2c4c34e5": ("Markova AI: Setup & Configuration Check", "Markova AI: Quick Setup Verification and Config Check"),
    "fb5b8d20-795d-41fb-bd96-415086a1048e": ("Markova AI Call Center: Production Architecture & Remediation", "Markova AI Call Center: Production Architecture & Remediation"),
    "c9e9b63f-aea4-4f62-a64d-52ed2cb74699": ("FlexPay v3: Implementation & Deployment", "FlexPay v3: Implementation, M-PESA & Semifinalist Architecture"),
    "230ab181-d8db-4a14-aa6a-d9920d4ee373": ("FlexPay: FinTech Architecture & Security Engine", "FlexPay: FinTech Architecture, Safaricom M-Pesa & Security"),
    "276f7555-fd7e-4cbc-ac3e-ce64017acf3a": ("FlexPay: Vercel & Supabase Schema Setup", "FlexPay: Vercel, Supabase Schema & Production Deployment"),
    "f161c209-ff08-4260-ba7e-b709dbb7afde": ("Restoring Lost Project History & System Persistence", "FlexPay & Markova: Comprehensive History Recovery and State Persistence"),
    "046e114c-3fd5-481e-bb41-e36b14e27d4c": ("Markova Website: Deep Architecture & Full Review", "Markova Website: Full System Analysis, Components and Page Design"),
    "7f77f87f-31bc-4a88-88e8-ca3358bda274": ("Project Deep Dive Analysis", "Markova Website: Architectural Deep Dive and Structural Analysis"),
    "8c46c2df-814f-4275-85dc-11cb7cc5ba55": ("Markova Technologies: Website Setup", "Markova Technologies: Website Setup and GitHub Repository Alignment"),
    "21a3a841-e8eb-4dea-ab29-4475defb348e": ("Developing Chacha AI Tutor", "Personal Projects: Chacha AI Tutor for Student Learning"),
    "40c565e9-c0b5-4b83-ac8b-f8841ac13291": ("Creative Portfolio Redesign & Architecture", "Personal Projects: Portfolio Creative Direction, Design and Frontend Architecture"),
    "88bddc77-4834-4f3d-a8d7-7e468fe7d4bf": ("Portfolio: Conversation History Continuation", "Personal Projects: Portfolio Continuity and Project Context"),
    "8ac28910-246d-4ea9-b332-90d01a198db6": ("Responsive & Accessibility Overhaul", "Responsive Design and Accessibility Improvements"),
    "2d4a638d-e113-4912-beac-7b9674ac595b": ("Building AI Startup Validator", "AI Startup Validator Concept and Development"),
    "5f2d03d1-48a8-49a7-8263-be5decd2eb5f": ("Building NuraCare Health Agent", "NuraCare Healthcare Agent & Voice Integration"),
    "a42b31ce-5f60-4b58-8aee-e3bd95a719f8": ("Stock Management System Development", "Inventory & Stock Management System")
}

def encode_varint(val):
    out = bytearray()
    while True:
        b = val & 0x7f
        val >>= 7
        if val:
            out.append(b | 0x80)
        else:
            out.append(b)
            break
    return bytes(out)

def encode_tag(fnum, wtype):
    return encode_varint((fnum << 3) | wtype)

def encode_length_delimited(fnum, val_bytes):
    return encode_tag(fnum, 2) + encode_varint(len(val_bytes)) + val_bytes

def encode_varint_field(fnum, val):
    return encode_tag(fnum, 0) + encode_varint(val)

def encode_timestamp(fnum, seconds, nanos=0):
    ts_bytes = encode_varint_field(1, seconds) + encode_varint_field(2, nanos)
    return encode_length_delimited(fnum, ts_bytes)

def extract_transcript_first_prompt(cid):
    transcript_path = os.path.join(brain_dir, cid, ".system_generated", "logs", "transcript.jsonl")
    if not os.path.exists(transcript_path):
        return ""
    with open(transcript_path, "r", encoding="utf-8", errors="ignore") as f:
        for line in f:
            if '"type":"USER_INPUT"' in line:
                try:
                    data = json.loads(line)
                    content = data.get("content", "")
                    cleaned = re.sub(r'<[^>]+>', '', content)
                    lines = [l.strip() for l in cleaned.splitlines() if l.strip() and not l.strip().startswith('The current') and not l.strip().startswith('Active Document')]
                    if lines:
                        return " ".join(lines)
                except:
                    pass
    return ""

def build_summary_proto_for_conv(db_path):
    cid = os.path.basename(db_path)[:-3]
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    
    cur.execute("SELECT trajectory_id, cascade_id, trajectory_type, source FROM trajectory_meta")
    tmeta = cur.fetchone()
    traj_id = tmeta[0] if tmeta else os.path.basename(db_path)[:-3]
    traj_type = tmeta[2] if tmeta else 4
    
    cur.execute("SELECT count(*) FROM steps")
    step_count = cur.fetchone()[0]
    
    cur.execute("SELECT data FROM trajectory_metadata_blob WHERE id = 'main'")
    blob_row = cur.fetchone()
    traj_blob = blob_row[0] if blob_row else b""
    
    workspace_uri = ""
    if traj_blob:
        uris = re.findall(rb"file:///[^\x00-\x1f\"'\\]+", traj_blob)
        if uris:
            workspace_uri = uris[0].decode('utf-8', errors='ignore')
    if not workspace_uri:
        workspace_uri = "file:///d:/Projects/Markova%20Projects/Markova%20Ai%20Call%20Center"
        
    mtime = int(os.path.getmtime(db_path))
    ctime = int(os.path.getctime(db_path))
    conn.close()
    
    if cid in CUSTOM_TITLES:
        title, summary = CUSTOM_TITLES[cid]
    else:
        prompt = extract_transcript_first_prompt(cid)
        if prompt:
            title = prompt[:60]
            summary = prompt[:120]
        else:
            title = f"Markova AI: Conversation {cid[:8]}"
            summary = f"Markova AI Conversation {cid[:8]}"
            
    p = encode_length_delimited(1, summary.encode('utf-8'))
    p += encode_varint_field(2, step_count)
    p += encode_timestamp(3, mtime)
    p += encode_length_delimited(4, traj_id.encode('utf-8'))
    p += encode_varint_field(5, 1)
    p += encode_timestamp(7, ctime)
    
    ws_meta = encode_length_delimited(1, workspace_uri.encode('utf-8'))
    p += encode_length_delimited(9, ws_meta)
    p += encode_timestamp(10, mtime)
    
    annot = encode_length_delimited(1, title.encode('utf-8'))
    p += encode_length_delimited(15, annot)
    
    if traj_blob:
        p += encode_length_delimited(17, traj_blob)
        
    p += encode_varint_field(22, traj_type)
    return cid, p, title, summary

def sync():
    all_dbs = [f for f in os.listdir(conv_dir) if f.endswith('.db')]
    permanent_json_dict = {}
    
    if os.path.exists(permanent_json_path):
        try:
            with open(permanent_json_path, "r", encoding="utf-8") as f:
                permanent_json_dict = json.load(f)
        except:
            pass
            
    for f in all_dbs:
        full_path = os.path.join(conv_dir, f)
        cid = f[:-3]
        try:
            cid_out, proto, title, summary = build_summary_proto_for_conv(full_path)
            b64_str = base64.b64encode(proto).decode('utf-8')
            permanent_json_dict[cid_out] = b64_str
        except Exception as e:
            print(f"Error processing {f}: {e}")

    with open(permanent_json_path, "w", encoding="utf-8") as f:
        json.dump(permanent_json_dict, f, indent=2)

    def encode_row(b64_str):
        return encode_length_delimited(1, b64_str.encode('utf-8'))

    def encode_map_entry(key_str, b64_str):
        entry_data = encode_length_delimited(1, key_str.encode('utf-8')) + encode_length_delimited(2, encode_row(b64_str))
        return encode_length_delimited(1, entry_data)

    new_raw = b""
    for k, v in permanent_json_dict.items():
        new_raw += encode_map_entry(k, v)

    new_b64 = base64.b64encode(new_raw).decode('utf-8')

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.execute("UPDATE ItemTable SET value = ? WHERE key = 'antigravityUnifiedStateSync.trajectorySummaries'", (new_b64,))
    conn.commit()
    conn.close()

    print(f"Synced {len(permanent_json_dict)} conversations successfully to permanent storage and state.vscdb.")

if __name__ == "__main__":
    sync()
