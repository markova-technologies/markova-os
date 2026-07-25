
import os
import asyncio
import sys

# Ensure we can import from the main app
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from main_natural_voice import AmharicAIAssistant, groq_client, get_response

async def main():
    print("🚀 Initializing Amharic AI Chat CLI...")
    
    if not groq_client:
        print("❌ Error: GROQ_API_KEY not found or invalid.")
        print("   Please check your .env file.")
        return

    ai_assistant = AmharicAIAssistant()
    
    print("\n✅ AI Assistant Ready!")
    print("--------------------------------------------------")
    print("Start typing to chat. Type 'quit' or 'exit' to stop.")
    print("--------------------------------------------------\n")
    
    while True:
        try:
            user_input = input("👤 You: ").strip()
            
            if user_input.lower() in ['quit', 'exit']:
                print("👋 Exiting...")
                break
                
            if not user_input:
                continue
                
            print("🤖 Almaz is thinking...", end="\r")
            
            # Generate response using the persistent assistant instance
            response = ai_assistant.generate_response(user_input)
            
            # Clear loading text
            print(" " * 30, end="\r")
            
            print(f"🤖 Almaz: {response}")
            print("-" * 30)
            
        except KeyboardInterrupt:
            print("\n👋 Exiting...")
            break
        except Exception as e:
            print(f"\n❌ Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
