export interface CoachMessage {
  id: string;
  role: "user" | "model";
  text: string;
  createdAt: Date;
  /** A session the coach built ("Build today's workout"), ready to open in the logger. */
  workout?: {
    name: string;
    why?: string;
    targetMuscles?: import("./workout").MuscleGroup[];
    exercises: import("./workout").Exercise[];
  };
}

export interface GeminiTextResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}
