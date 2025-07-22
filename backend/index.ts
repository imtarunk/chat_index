import fs from "fs";
import readline from "readline";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import "dotenv/config";

// --- Type Definitions ---
interface ChatMessage {
  content: string;
  role: "user" | "assistant";
}

interface ChatSession {
  id: string;
  messages: ChatMessage[];
}

interface MessageForBatch {
  session_id: string;
  sender: string;
  message: string;
}

interface SupabaseRecord extends MessageForBatch {
  embedding: number[];
}

// --- Configuration ---
const FILE_PATH =
  "/Users/tarunksaini/code/work-adgent/chat-pgvector/chat_sessions_dec2024.json"; // Path to your NDJSON file
const BATCH_SIZE = 100; // Number of messages to process in each batch

// --- Initialize Clients ---
const supabase: SupabaseClient = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const gemini = new OpenAI({
  apiKey: process.env.GEMINI_API_KEY!,
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
});

/**
 * Processes a batch of messages: generates embeddings and inserts them into Supabase.
 * @param {MessageForBatch[]} batch - An array of message objects to process.
 * @returns {Promise<{ success: number; failed: number }>} - The count of successful and failed operations.
 */
async function processBatch(
  batch: MessageForBatch[]
): Promise<{ success: number; failed: number }> {
  if (batch.length === 0) return { success: 0, failed: 0 };

  console.log(`\nProcessing a batch of ${batch.length} messages...`);

  try {
    const inputs = batch.map((item) => item.message);
    const embeddingResponse = await gemini.embeddings.create({
      model: "text-embedding-004",
      input: inputs,
    });

    const recordsToInsert: SupabaseRecord[] = batch.map((item, index) => ({
      ...item,
      embedding: embeddingResponse.data[index].embedding,
    }));

    const { error } = await supabase
      .from("chat_sessions")
      .insert(recordsToInsert);

    if (error) {
      console.error("Error inserting batch:", error.message);
      return { success: 0, failed: batch.length };
    }

    console.log(`Successfully indexed ${batch.length} messages.`);
    return { success: batch.length, failed: 0 };
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : "An unknown error occurred";
    console.error(`An error occurred during batch processing: ${errorMessage}`);
    return { success: 0, failed: batch.length };
  }
}

/**
 * Main function to stream the file and coordinate batch processing.
 */
async function main() {
  console.log(`Starting to stream and index file: ${FILE_PATH}`);
  const fileStream = fs.createReadStream(FILE_PATH);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let messageBatch: MessageForBatch[] = [];
  let lineCount = 0;
  let totalSuccess = 0;
  let totalFailed = 0;

  for await (const line of rl) {
    lineCount++;
    if (line.trim() === "") continue;

    try {
      const chatSession: ChatSession = JSON.parse(line);
      for (const msg of chatSession.messages) {
        if (msg.content && msg.role) {
          messageBatch.push({
            session_id: chatSession.id,
            sender: msg.role,
            message: msg.content,
          });
        }
      }
    } catch (e) {
      const errorMessage =
        e instanceof Error ? e.message : "An unknown parsing error occurred";
      console.warn(
        `Could not parse line ${lineCount}. Skipping. Error: ${errorMessage}`
      );
      totalFailed++; // Consider a failed parse as a failure
    }

    if (messageBatch.length >= BATCH_SIZE) {
      const result = await processBatch(messageBatch);
      totalSuccess += result.success;
      totalFailed += result.failed;
      messageBatch = []; // Reset the batch
    }
  }

  if (messageBatch.length > 0) {
    const result = await processBatch(messageBatch);
    totalSuccess += result.success;
    totalFailed += result.failed;
  }

  console.log("\n--- Indexing Complete ---");
  console.log(`Total lines read: ${lineCount}`);
  console.log(`Successfully indexed messages: ${totalSuccess}`);
  console.log(`Failed messages: ${totalFailed}`);
  console.log("-------------------------");
}

main().catch(console.error);
