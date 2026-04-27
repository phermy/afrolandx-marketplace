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
        model: "gpt-5-mini",
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...messages
        ],
        max_completion_tokens: 1000,
      });

      const choice = completion.choices[0];
      if (!choice) {
        console.error('Chatbot: no choices returned from API');
        return "I'm here to help! Could you please rephrase your question?";
      }

      // Check for content (standard response)
      const content = choice.message?.content;
      if (content && content.trim().length > 0) {
        return content;
      }

      // Check for refusal (newer models surface refusals here)
      const refusal = (choice.message as any)?.refusal;
      if (refusal && refusal.trim().length > 0) {
        console.warn('Chatbot: model returned a refusal:', refusal);
        return "I'm not able to help with that specific request, but I'm happy to assist with product recommendations, outfit advice, sizing guidance, or order questions for Afrolandx!";
      }

      // Log the full choice for debugging
      console.error('Chatbot: empty content and no refusal. finish_reason:', choice.finish_reason, 'choice:', JSON.stringify(choice));
      return "I'm here and ready to help! Could you try asking your question again?";

    } catch (error: any) {
      console.error('Chatbot API error:', error?.message ?? error);
      if (error?.status === 429) {
        return "I'm receiving a lot of questions right now — please try again in a moment!";
      }
      if (error?.status === 503 || error?.code === 'ECONNREFUSED') {
        return "Our AI assistant is briefly unavailable. Please try again shortly.";
      }
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
