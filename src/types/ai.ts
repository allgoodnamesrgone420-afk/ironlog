export interface CoachMessage {
  id: string;
  role: "user" | "model";
  text: string;
  createdAt: Date;
}

export interface GeminiTextResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}
