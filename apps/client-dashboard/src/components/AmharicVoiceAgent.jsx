import React, { useEffect } from 'react';
import './AmharicVoiceAgent.css';

const AmharicVoiceAgent = () => {
  useEffect(() => {
    // Check if the script is already loaded to prevent duplicates
    if (document.getElementById('voiceflow-script')) {
      return;
    }

    const script = document.createElement('script');
    script.id = 'voiceflow-script';
    script.type = 'text/javascript';
    script.src = 'https://cdn.voiceflow.com/widget-next/bundle.mjs';
    
    script.onload = () => {
      if (window.voiceflow && window.voiceflow.chat) {
        window.voiceflow.chat.load({
          verify: { projectID: '68bd60fefbdee64fab72767e' },
          url: 'https://general-runtime.voiceflow.com',
          versionID: 'production',
          voice: {
            url: "https://runtime-api.voiceflow.com"
          }
        });
      }
    };

    document.body.appendChild(script);

    // Cleanup function - Voiceflow doesn't have a simple "unload" method,
    // so we typically leave it running or hide it. 
    // If you need it to be strictly scoped to this component, we can hide the widget container.
    return () => {
      // Hide the widget container if the component is unmounted
      const vfContainer = document.getElementById('voiceflow-chat');
      if (vfContainer) {
        vfContainer.style.display = 'none';
      }
    };
  }, []);

  return null; // The Voiceflow widget renders its own UI in the body
};

export default AmharicVoiceAgent;
