// public/scripts/extensions/scene-transition/index.js

import { SlashCommand } from "../../slash-commands/SlashCommand.js";
import {
  SlashCommandArgument,
  SlashCommandNamedArgument,
  ARGUMENT_TYPE
} from "../../slash-commands/SlashCommandArgument.js";
import { SlashCommandParser } from "../../slash-commands/SlashCommandParser.js";
import { getContext } from "../../st-context.js";

function buildAssistantMessage({ text }) {
  const ctx = getContext();
  const charName = ctx.characters?.[ctx.characterId]?.name;
  return {
    is_user: false,
    name: charName,
    send_date: Date.now(),
    mes: text
  };
}

async function insertAssistantMessage(text) {
  try {
    console.log('[Scene Transition] insertAssistantMessage called with text:', text);
    
    const ctx = getContext();
    console.log('[Scene Transition] Got context:', !!ctx);
    
    const { chat, eventSource, eventTypes } = ctx;
    console.log('[Scene Transition] Context properties:', { 
      hasChat: !!chat, 
      hasEventSource: !!eventSource, 
      hasEventTypes: !!eventTypes 
    });

    const msg = buildAssistantMessage({ text });
    console.log('[Scene Transition] Built message:', msg);
    
    chat.push(msg);
    const msgId = chat.length - 1;
    console.log('[Scene Transition] Message added to chat at index:', msgId);

    await eventSource.emit(eventTypes.MESSAGE_RECEIVED, msgId);
    console.log('[Scene Transition] MESSAGE_RECEIVED event emitted');
    
    ctx.addOneMessage(msg);
    console.log('[Scene Transition] addOneMessage called');
    
    await eventSource.emit(eventTypes.CHARACTER_MESSAGE_RENDERED, msgId);
    console.log('[Scene Transition] CHARACTER_MESSAGE_RENDERED event emitted');
    
    await ctx.saveChat();
    console.log('[Scene Transition] Chat saved');
  } catch (error) {
    console.error('[Scene Transition] Error inserting message:', error);
    throw error;
  }
}

async function generateSceneLine({ instruction, style, maxTokens }) {
  try {
    console.log('[Scene Transition] generateSceneLine called with:', { instruction, style, maxTokens });
    
    const ctx = getContext();
    const { generateQuietPrompt, substituteParams } = ctx;

    if (!generateQuietPrompt) {
      console.error('[Scene Transition] generateQuietPrompt not available');
      // Fallback to test message if LLM not available
      const testMessage = `[DEBUG] Scene transition test - ${instruction || 'no instruction'} ${style ? `(style: ${style})` : ''}`;
      console.log('[Scene Transition] Using fallback test message:', testMessage);
      return testMessage;
    }

    const quietPrompt = substituteParams(
      `[OOC Scene Direction]
Write a scene transition, using the perspective of {{char}}. If the existing conversation indicates that the story hand reached the end of an event, describe the beginning of a new situation where {{char}} and {{user}} would interact again. Otherwise, transition {{char}} and {{user}} to a new location that would make sense. Describe the sight and sound of the new environment briefly, then have {{char}} start the interaction with {{user}} in this new setting. Do not write dialog for {{user}}. If the location change warrants a new outfit and there's logically a gap in the timeline where {{char}} could have changed, feel free to mention the outfit change briefly.
${style ? "Style hint: " + style : ""}
${instruction ? "Scene notes: " + instruction : ""}
Return only the character's spoken or internal line (no extra narrative).`
    );

    console.log('[Scene Transition] Generated prompt:', quietPrompt);

    const result = await generateQuietPrompt({
      quietPrompt,
      quietToLoud: true,
      maxTokens: maxTokens ? Number(maxTokens) : 120
    });

    const finalResult = (typeof result === 'string' ? result.trim() : String(result ?? '').trim());
    console.log('[Scene Transition] LLM result:', finalResult);
    return finalResult;
  } catch (error) {
    console.error('[Scene Transition] Error generating scene line:', error);
    // Fallback to test message on error
    const testMessage = `[DEBUG] Scene transition test - ${instruction || 'no instruction'} ${style ? `(style: ${style})` : ''}`;
    console.log('[Scene Transition] Using fallback due to error:', testMessage);
    return testMessage;
  }
}

function registerSlashCommand() {
  try {
    SlashCommandParser.addCommandObject(
      SlashCommand.fromProps({
        name: "scene",
        aliases: ["scenecut", "sc"],
        returns: "Insert the next in-character line for a scene transition (OOC prompt hidden)",
        callback: async (named, unnamed) => {
          try {
            console.log('[Scene Transition] Slash command triggered!');
            console.log('[Scene Transition] Named args:', named);
            console.log('[Scene Transition] Unnamed args:', unnamed);
            
            // Use default instruction if none provided
            const instruction = typeof unnamed === 'string' && unnamed.trim() 
              ? unnamed 
              : "Allow the character to transition to a new scene that makes sense.";
            const style = named?.style || undefined;
            const max = named?.max || "120"; // Use default value

            console.log('[Scene Transition] Processed args:', { instruction, style, max });

            const line = await generateSceneLine({
              instruction,
              style,
              maxTokens: max
            });

            console.log('[Scene Transition] Generated line:', line);

            if (line) {
              await insertAssistantMessage(line);
              console.log('[Scene Transition] Message inserted successfully');
              return "Scene line inserted.";
            }
            console.log('[Scene Transition] No line generated');
            return "No output generated.";
          } catch (error) {
            console.error('[Scene Transition] Command execution error:', error);
            return `Error: ${error.message}`;
          }
        },
        namedArgumentList: [
          SlashCommandNamedArgument.fromProps({
            name: "style",
            description: "Optional style hint (e.g., cinematic, noir)",
            typeList: [ARGUMENT_TYPE.STRING]
          }),
          SlashCommandNamedArgument.fromProps({
            name: "max",
            description: "Max tokens limit",
            typeList: [ARGUMENT_TYPE.NUMBER],
            defaultValue: "120"
          })
        ],
        unnamedArgumentList: [
          SlashCommandArgument.fromProps({
            description: "Optional scene notes (will use default if not provided)",
            typeList: [ARGUMENT_TYPE.STRING],
            isRequired: false
          })
        ],
        helpString: `
          <div><strong>/scene</strong> — quietly generate a transition line (OOC prompt hidden)</div>
          <div><strong>Example:</strong></div>
          <pre>/scene</pre>
          <pre>/scene style="cinematic" The tavern door slams; the rain outside picks up.</pre>
        `
      })
    );
    console.log('[Scene Transition] Slash command registered successfully');
  } catch (error) {
    console.error('[Scene Transition] Error registering slash command:', error);
  }
}

function onReady() {
  console.log('[Scene Transition] Extension initializing...');
  registerSlashCommand();
}

// Initialize the extension when the app is ready
(function() {
  const ctx = getContext();
  if (ctx && ctx.eventSource && ctx.eventTypes) {
    ctx.eventSource.on(ctx.eventTypes.APP_READY, onReady);
    console.log('[Scene Transition] Extension loaded, waiting for APP_READY event');
  } else {
    // Fallback: try to register immediately if context is available
    console.log('[Scene Transition] Context available, registering immediately');
    onReady();
  }
})();