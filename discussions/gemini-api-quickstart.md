<br />

| We have updated our[Terms of Service](https://ai.google.dev/gemini-api/terms).

This quickstart shows you how to install our[libraries](https://ai.google.dev/gemini-api/docs/libraries)and make your first Gemini API request.

## Before you begin

You need a Gemini API key. If you don't already have one, you can[get it for free in Google AI Studio](https://aistudio.google.com/app/apikey).

## Install the Google GenAI SDK

### Python

Using[Python 3.9+](https://www.python.org/downloads/), install the[`google-genai`package](https://pypi.org/project/google-genai/)using the following[pip command](https://packaging.python.org/en/latest/tutorials/installing-packages/):  

    pip install -q -U google-genai

### JavaScript

Using[Node.js v18+](https://nodejs.org/en/download/package-manager), install the[Google Gen AI SDK for TypeScript and JavaScript](https://www.npmjs.com/package/@google/genai)using the following[npm command](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm):  

    npm install @google/genai

## Make your first request

Here is an example that uses the[`generateContent`](https://ai.google.dev/api/generate-content#method:-models.generatecontent)method to send a request to the Gemini API using the Gemini 2.5 Flash model.

If you[set your API key](https://ai.google.dev/gemini-api/docs/api-key#set-api-env-var)as the environment variable`GEMINI_API_KEY`, it will be picked up automatically by the client when using the[Gemini API libraries](https://ai.google.dev/gemini-api/docs/libraries). Otherwise you will need to[pass your API key](https://ai.google.dev/gemini-api/docs/api-key#provide-api-key-explicitly)as an argument when initializing the client.

Note that all code samples in the Gemini API docs assume that you have set the environment variable`GEMINI_API_KEY`.  

### Python

    from google import genai

    # The client gets the API key from the environment variable `GEMINI_API_KEY`.
    client = genai.Client()

    response = client.models.generate_content(
        model="gemini-2.5-flash", contents="Explain how AI works in a few words"
    )
    print(response.text)

### JavaScript

    import { GoogleGenAI } from "@google/genai";

    // The client gets the API key from the environment variable `GEMINI_API_KEY`.
    const ai = new GoogleGenAI({});

    async function main() {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: "Explain how AI works in a few words",
      });
      console.log(response.text);
    }

    main();

## What's next

Now that you made your first API request, you might want to explore the following guides that show Gemini in action:

- [Text generation](https://ai.google.dev/gemini-api/docs/text-generation)
- [Image generation](https://ai.google.dev/gemini-api/docs/image-generation)
- [Image understanding](https://ai.google.dev/gemini-api/docs/image-understanding)
- [Thinking](https://ai.google.dev/gemini-api/docs/thinking)
- [Function calling](https://ai.google.dev/gemini-api/docs/function-calling)
- [Long context](https://ai.google.dev/gemini-api/docs/long-context)
- [Embeddings](https://ai.google.dev/gemini-api/docs/embeddings)