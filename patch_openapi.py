import yaml

with open('openapi.yaml', 'r', encoding='utf-8') as f:
    docs = yaml.safe_load(f)

if '/v1/billing/portal' not in docs['paths']:
    docs['paths']['/v1/billing/portal'] = {
        'post': {
            'summary': 'Generate Billing Portal URL',
            'tags': ['Billing'],
            'security': [{'BearerAuth': []}],
            'responses': {
                '200': {
                    'description': 'Returns a Stripe customer portal session URL',
                    'content': {
                        'application/json': {
                            'schema': {
                                'type': 'object',
                                'properties': {
                                    'url': {'type': 'string', 'format': 'uri'}
                                }
                            }
                        }
                    }
                }
            }
        }
    }

if '/v1/white-label' not in docs['paths']:
    docs['paths']['/v1/white-label'] = {
        'get': {
            'summary': 'Get White-Label Configuration',
            'tags': ['White-Label'],
            'security': [{'BearerAuth': []}],
            'responses': {
                '200': {
                    'description': 'Current white-label settings',
                    'content': {
                        'application/json': {
                            'schema': {
                                'type': 'object',
                                'properties': {
                                    'custom_domain': {'type': 'string'},
                                    'white_label_enabled': {'type': 'boolean'},
                                    'custom_tts_voice_id': {'type': 'string'}
                                }
                            }
                        }
                    }
                }
            }
        },
        'post': {
            'summary': 'Update White-Label Configuration',
            'tags': ['White-Label'],
            'security': [{'BearerAuth': []}],
            'requestBody': {
                'content': {
                    'application/json': {
                        'schema': {
                            'type': 'object',
                            'properties': {
                                'custom_domain': {'type': 'string'},
                                'white_label_enabled': {'type': 'boolean'},
                                'custom_tts_voice_id': {'type': 'string'}
                            }
                        }
                    }
                }
            },
            'responses': {
                '200': {
                    'description': 'Success'
                }
            }
        }
    }

with open('openapi.yaml', 'w', encoding='utf-8') as f:
    yaml.dump(docs, f, default_flow_style=False, sort_keys=False)

print("OpenAPI patched successfully.")
