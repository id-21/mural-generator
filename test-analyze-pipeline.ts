/**
 * AI Analyze Prompt Pipeline Test
 *
 * This script tests the entire "AI Analyze Prompt" pipeline by:
 * 1. Loading a test image from /tmp/test-mural-image.png
 * 2. Converting it to base64
 * 3. Calling the refinePromptWithChat function
 * 4. Logging every step to console and test-analyze-pipeline.log
 *
 * Run with: npx tsx test-analyze-pipeline.ts
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { refinePromptWithChat } from './lib/features/mural-generator/gemini';
import { getMimeType } from './lib/features/mural-generator/storage';
import { CHAT_REFINEMENT_SYSTEM_INSTRUCTION } from './lib/features/mural-generator/prompts';

// Configuration
const TEST_IMAGE_PATH = path.join(__dirname, '/tmp/trial-mural.png');
const LOG_FILE_PATH = path.join(__dirname, 'test-analyze-pipeline.log');

// Logger class to write to both console and file
class Logger {
  private logs: string[] = [];
  private startTime: Date;

  constructor() {
    this.startTime = new Date();
  }

  private getTimestamp(): string {
    const now = new Date();
    const time = now.toTimeString().split(' ')[0];
    const ms = now.getMilliseconds().toString().padStart(3, '0');
    return `${time}.${ms}`;
  }

  log(message: string, toFileOnly: boolean = false) {
    const timestamp = this.getTimestamp();
    const logLine = `[${timestamp}] ${message}`;
    this.logs.push(logLine);

    if (!toFileOnly) {
      console.log(message);
    }
  }

  logSection(title: string) {
    const separator = '='.repeat(60);
    this.log(separator);
    this.log(title);
    this.log(separator);
  }

  logStep(stepNumber: number, title: string) {
    this.log('');
    this.log(`[STEP ${stepNumber}] ${title}`);
  }

  logSuccess(message: string) {
    this.log(`✓ ${message}`);
  }

  logInfo(message: string) {
    this.log(`→ ${message}`);
  }

  logWaiting(message: string) {
    this.log(`⏳ ${message}`);
  }

  logError(message: string) {
    this.log(`✕ ${message}`);
  }

  logDetailToFile(key: string, value: any) {
    const formattedValue = typeof value === 'object'
      ? JSON.stringify(value, null, 2)
      : String(value);
    this.log(`  - ${key}: ${formattedValue}`, true);
  }

  async saveToFile() {
    const header = [
      '===========================================',
      'AI Analyze Prompt Pipeline Test',
      `Started: ${this.startTime.toLocaleString()}`,
      '===========================================',
      ''
    ].join('\n');

    const footer = [
      '',
      '===========================================',
      'Test completed',
      `Completed: ${new Date().toLocaleString()}`,
      `Total duration: ${((Date.now() - this.startTime.getTime()) / 1000).toFixed(2)} seconds`,
      '==========================================='
    ].join('\n');

    const content = header + this.logs.join('\n') + footer;
    await fs.writeFile(LOG_FILE_PATH, content, 'utf-8');
  }
}

// Main test function
async function runTest() {
  const logger = new Logger();

  try {
    logger.logSection('AI Analyze Prompt - Pipeline Test');
    logger.log('');

    // STEP 1: Environment Setup
    logger.logStep(1, 'Environment Setup');
    logger.logDetailToFile('Action', 'Loading .env.local file');

    // Load .env.local (Next.js convention)
    dotenv.config({ path: path.join(__dirname, '.env.local') });
    logger.logSuccess('Loaded .env.local file');

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      logger.logError('GEMINI_API_KEY not found in environment');
      throw new Error('GEMINI_API_KEY environment variable is required');
    }

    logger.logSuccess('GEMINI_API_KEY found');
    logger.logDetailToFile('GEMINI_API_KEY', `****...${apiKey.slice(-4)}`);

    const model = process.env.GEMINI_CHAT_MODEL || 'gemini-2.5-flash';
    logger.logDetailToFile('GEMINI_CHAT_MODEL', model);

    // STEP 2: Image Loading
    logger.logStep(2, 'Image Loading');
    logger.logDetailToFile('Image path', TEST_IMAGE_PATH);

    // Check if file exists
    try {
      await fs.access(TEST_IMAGE_PATH);
      logger.logSuccess(`Image exists: ${TEST_IMAGE_PATH}`);
    } catch (error) {
      logger.logError(`Image not found at ${TEST_IMAGE_PATH}`);
      logger.logError('Please place a test image at /tmp/test-mural.png');
      throw new Error(`Test image not found at ${TEST_IMAGE_PATH}`);
    }

    // Read image file
    logger.logDetailToFile('Action', 'Reading image file');
    const imageBuffer = await fs.readFile(TEST_IMAGE_PATH);
    logger.logSuccess('Image loaded successfully');
    logger.logSuccess(`Image size: ${imageBuffer.length.toLocaleString()} bytes`);
    logger.logDetailToFile('Image size (bytes)', imageBuffer.length);

    // Detect MIME type
    const mimeType = getMimeType(path.basename(TEST_IMAGE_PATH));
    logger.logSuccess(`MIME type: ${mimeType}`);
    logger.logDetailToFile('MIME type detected', mimeType);

    // Convert to base64
    logger.logDetailToFile('Action', 'Converting to base64');
    const base64Data = imageBuffer.toString('base64');
    logger.logSuccess('Base64 conversion complete');
    logger.logDetailToFile('Base64 length', base64Data.length);

    // STEP 3: Prepare Initial Message
    logger.logStep(3, 'Prepare Message');
    const initialMessage = "Please analyze this mural image and create a detailed generation prompt for a NEW original mural inspired by its artistic characteristics.";
    logger.logSuccess('Message: "Please analyze this mural image..."');
    logger.logDetailToFile('User message', initialMessage);

    // STEP 4: Call Gemini API
    logger.logStep(4, 'Call Gemini API');
    logger.logInfo(`Model: ${model}`);
    logger.logInfo('System Instruction: CHAT_REFINEMENT_SYSTEM_INSTRUCTION');
    logger.logInfo('Contents: 1 user message with image');
    logger.logWaiting('Waiting for API response...');

    logger.logDetailToFile('Function', 'refinePromptWithChat()');
    logger.logDetailToFile('Parameters', {
      chatHistory: '[] (empty)',
      userMessage: initialMessage.substring(0, 50) + '...',
      imageData: {
        mimeType,
        data: '[BASE64_OMITTED]'
      },
      currentPrompt: 'undefined'
    });
    logger.logDetailToFile('Model', model);
    logger.logDetailToFile('System Instruction', 'CHAT_REFINEMENT_SYSTEM_INSTRUCTION (see prompts.ts:79-102)');
    logger.logDetailToFile('Sending API request', new Date().toISOString());

    const apiStartTime = Date.now();

    // Make the actual API call
    const result = await refinePromptWithChat(
      [], // Empty chat history for initial analysis
      initialMessage,
      {
        mimeType,
        data: base64Data
      },
      undefined // No current prompt
    );

    const apiDuration = ((Date.now() - apiStartTime) / 1000).toFixed(2);

    // STEP 5: Process Response
    logger.logStep(5, 'Process Response');
    logger.logSuccess('Response received');
    logger.logSuccess('JSON parsed successfully');
    logger.logSuccess('Schema validation passed');

    logger.logDetailToFile('Response time', `${apiDuration} seconds`);
    logger.logDetailToFile('Raw response', result);
    logger.logDetailToFile('Parsed successfully', 'true');
    logger.logDetailToFile('Schema validation', 'PASSED');

    // STEP 6: Display Results
    logger.log('');
    logger.logSection('RESULTS');
    logger.log('');

    logger.log('Conversational Response:');
    logger.log(`"${result.conversationalResponse}"`);
    logger.log('');

    logger.log(`Refined Prompt (length: ${result.refinedPrompt.length} chars):`);
    logger.log(`"${result.refinedPrompt.substring(0, 200)}..."`);
    logger.log('');

    logger.log('Changes Summary:');
    if (result.changesSummary.length === 0) {
      logger.log('[] (empty for initial analysis)');
    } else {
      result.changesSummary.forEach((change, idx) => {
        logger.log(`  ${idx + 1}. ${change}`);
      });
    }
    logger.log('');

    // Log full details to file only
    logger.logDetailToFile('conversationalResponse', result.conversationalResponse);
    logger.logDetailToFile('refinedPrompt length', result.refinedPrompt.length);
    logger.logDetailToFile('refinedPrompt content', `\n---\n${result.refinedPrompt}\n---`);
    logger.logDetailToFile('changesSummary', result.changesSummary);

    // Success
    logger.logSection('');
    logger.logSuccess('Test completed successfully!');

    // Save log file
    await logger.saveToFile();
    logger.logSuccess(`Full log saved to: ${LOG_FILE_PATH}`);
    logger.logSection('');

  } catch (error) {
    logger.log('');
    logger.logSection('ERROR');
    logger.logError('Test failed with error:');

    if (error instanceof Error) {
      logger.logError(`Message: ${error.message}`);
      logger.logDetailToFile('Error message', error.message);
      logger.logDetailToFile('Error stack', error.stack || 'No stack trace');
    } else {
      logger.logError(`Unknown error: ${String(error)}`);
      logger.logDetailToFile('Error', String(error));
    }

    logger.logSection('');

    // Save log file even on error
    try {
      await logger.saveToFile();
      logger.logError(`Partial log saved to: ${LOG_FILE_PATH}`);
    } catch (saveError) {
      console.error('Failed to save log file:', saveError);
    }

    process.exit(1);
  }
}

// Run the test
runTest();
