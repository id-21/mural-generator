# Mural Generator App - Comprehensive Development Plan

## 1. The Core "Mural" Concept
* **Definition:** Non-repeating, scale-to-fit wallpaper patterns used as statement pieces.
* **Requirement:** High artistic detail and specific mood/color definitions. Unlike simple repeats, these require complex composition.
* **Current Goal:** Generate low-fidelity prototypes for internal review. No immediate need for upscaling or printing integration.

## 2. The "Nano Banana" Workflow Refinement
The workflow has been refined to accommodate the fact that Nano Banana prefers narrative prompts, while the app requires structured data for iteration.

### Step A: Image Analysis (Gemini)
* **Input:** Reference Image.
* **Output format:** Strict JSON.
* **Fields required:**
    * `text_message`: A conversational summary for the user (displayed in the Chat UI).
    * `json_prompt`: Structured data containing style, subject, medium, and texture.
* **New Parameters:** The analysis must explicitly extract:
    * **Artist Reference:** Specific artists who perfected the style.
    * **Medium:** The artistic tool used (e.g., watercolor, ink).
    * **Background Texture:** The substrate of the art (e.g., handmade paper, papyrus, metallic finish).

### Step B: The Bridge (JSON to Narrative)
* **Logic:** The app will *not* send the JSON directly to Nano Banana.
* **Action:** Send the `json_prompt` back to Gemini with a request to convert it into a rich, descriptive "Narrative Style Prompt."
* **Output:** A text block ready for image generation.

### Step C: Generation (Nano Banana)
* **Input:** The Narrative Prompt + Original Reference Image.
* **Output:** A completely new motif (not a copy) based on the textual and visual reference.

## 3. Advanced Feature Details

### Chat Mode & Data Separation
* The UI must handle the dual-nature of Gemini's response. The user sees the friendly `text_message`, while the system secretly stores the `json_prompt` for future edits or generation tasks.

### Color Scheme Swapping
* **Goal:** Change the mood without changing the content.
* **Mechanism:** Create a workflow that locks the "Subject/Composition" variables in the prompt while swapping the "Color/Palette" variables.
* **Example:** Converting a multi-colored floral mural to a Monochrome theme while keeping the exact same flower arrangement.

### Dynamic System Instructions
* **Context-Aware System Prompts:** Instead of one static system prompt, the app should generate system instructions based on the analysis of the reference.
    * *Example:* If the analysis JSON identifies the style as "Chinoiserie," the system adds a prompt layer: "Ensure fine details and avoid heavy brushstrokes."
* **Seamless Pattern Testing:** An overarching test to see if adding "You are a seamless pattern designer" to the system prompt allows the murals to be tiled/extended if necessary.

## 4. Infrastructure: Generalized Batch API
* **Purpose:** Cost efficiency and handling high volume.
* **Implementation:** A generalized queue system that allows different types of jobs to be sent to the Batch API (24h completion window).
* **Use Cases:**
    * **Bulk Image Analysis:** Uploading 50 reference images and getting 50 JSON analyses back overnight.
    * **Bulk Prompt Generation:** Converting a batch of JSON prompts into Narrative prompts.