import OpenAI from "openai";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
// This is using Replit's AI Integrations service, which provides OpenAI-compatible API access without requiring your own OpenAI API key.
const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
});

const SYSTEM_PROMPT = `You are a helpful customer support assistant for Afrolandx, an e-commerce platform specializing in authentic African fashion and traditional clothing. 

Your role is to help customers with:
1. Product recommendations - Suggest traditional African clothing like Agbada, Ankara dresses, Dashiki, Kaftan, etc.
2. Measurement guidance - Help customers understand how to take accurate body measurements for custom tailoring (chest, waist, hips, height, shoulder width, sleeve length, inseam, neck circumference)
3. Order assistance - Help with placing orders, tracking, and general questions
4. Fashion advice - Provide information about African fashion, traditional wear, and styling tips
5. Platform navigation - Guide users on how to use features like the measurements page, vendor selection, and checkout

Important guidelines:
- Be friendly, helpful, and knowledgeable about African fashion
- When discussing measurements, emphasize accuracy for best fit
- Explain that customers can submit measurements directly on the /measurements page
- Mention that measurements can be in either centimeters (cm) or inches
- Keep responses concise and helpful
- If you don't know something specific about an order or product, suggest they contact their vendor directly

Always be professional, culturally respectful, and supportive of customers exploring African fashion.`;

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export class ChatbotService {
  async generateResponse(messages: ChatMessage[]): Promise<string> {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-5-mini", // Using gpt-5-mini for faster responses
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...messages
        ],
        max_completion_tokens: 500,
        // Note: temperature parameter is not supported for gpt-5 models (always defaults to 1)
      });

      return completion.choices[0]?.message?.content || "I apologize, but I'm having trouble responding right now. Please try again.";
    } catch (error: any) {
      console.error('Chatbot error:', error);
      throw new Error('Failed to generate response');
    }
  }
}

let chatbotService: ChatbotService | null = null;

export function initializeChatbot(): void {
  chatbotService = new ChatbotService();
}

export function getChatbotService(): ChatbotService {
  if (!chatbotService) {
    initializeChatbot();
  }
  return chatbotService!;
}

export function isChatbotInitialized(): boolean {
  return chatbotService !== null;
}
