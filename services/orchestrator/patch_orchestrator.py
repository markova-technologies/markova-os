with open('main.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Patch get_agent_by_phone
old_query = '''            SELECT 
                pn.id as phone_number_id,
                pn.phone_number,
                pn.company_id,
                pn.settings as phone_settings,
                a.id as agent_id,
                a.name as agent_name,
                a.prompt,
                a.voice_provider,
                a.voice_id,
                a.model_provider,
                a.model_id
            FROM phone_numbers pn
            LEFT JOIN agents a ON a.id = pn.agent_id
            WHERE pn.phone_number =  AND pn.status = 'active'
            '''

new_query = '''            SELECT 
                pn.id as phone_number_id,
                pn.phone_number,
                pn.company_id,
                pn.settings as phone_settings,
                a.id as agent_id,
                a.name as agent_name,
                a.prompt,
                a.voice_provider,
                COALESCE(c.custom_tts_voice_id, a.voice_id) as voice_id,
                a.model_provider,
                a.model_id
            FROM phone_numbers pn
            LEFT JOIN agents a ON a.id = pn.agent_id
            LEFT JOIN companies c ON c.id = pn.company_id
            WHERE pn.phone_number =  AND pn.status = 'active'
            '''

if old_query in content:
    content = content.replace(old_query, new_query)

# Patch get_agent_by_name
old_query2 = '''            SELECT 
                id as agent_id,
                name as agent_name,
                prompt,
                voice_provider,
                voice_id,
                model_provider,
                model_id
            FROM agents
            WHERE company_id =  AND name =  AND status = 'active'
            '''

new_query2 = '''            SELECT 
                a.id as agent_id,
                a.name as agent_name,
                a.prompt,
                a.voice_provider,
                COALESCE(c.custom_tts_voice_id, a.voice_id) as voice_id,
                a.model_provider,
                a.model_id
            FROM agents a
            LEFT JOIN companies c ON c.id = a.company_id
            WHERE a.company_id =  AND a.name =  AND a.status = 'active'
            '''

if old_query2 in content:
    content = content.replace(old_query2, new_query2)

with open('main.py', 'w', encoding='utf-8') as f:
    f.write(content)
print("Patch successful")