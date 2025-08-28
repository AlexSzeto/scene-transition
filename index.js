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
    const ctx = getContext();
    const { chat, eventSource, eventTypes } = ctx;

    const msg = buildAssistantMessage({ text });
    chat.push(msg);
    const msgId = chat.length - 1;

    await eventSource.emit(eventTypes.MESSAGE_RECEIVED, msgId);
    ctx.addOneMessage(msg);
    await eventSource.emit(eventTypes.CHARACTER_MESSAGE_RENDERED, msgId);
    await ctx.saveChat();
  } catch (error) {
    console.error('[Scene Transition] Error inserting message:', error);
    throw error;
  }
}

async function generateSceneLine({ instruction, style, maxTokens }) {
  try {
    const ctx = getContext();
    const { generateQuietPrompt, substituteParams } = ctx;

    if (!generateQuietPrompt) {
      console.error('[Scene Transition] generateQuietPrompt not available');
      const testMessage = `[DEBUG] Scene transition test - ${instruction || 'no instruction'} ${style ? `(style: ${style})` : ''}`;
      return testMessage;
    }

    const quietPrompt = substituteParams(
      `[OOC Scene Direction]
Write a scene transition, using the perspective of {{char}}. If the existing conversation indicates that the story hand reached the end of an event, describe the beginning of a new situation where {{char}} and {{user}} would interact again. Otherwise, transition {{char}} and {{user}} to a new location that would make sense. Describe the sight and sound of the new environment briefly, then have {{char}} start the interaction with {{user}} in this new setting. Do not write dialog for {{user}}. If the location change warrants a new outfit and there's logically a gap in the timeline where {{char}} could have changed, feel free to mention the outfit change briefly.
${style ? "Style hint: " + style : ""}
${instruction ? "Scene notes: " + instruction : ""}
Return only the character's spoken or internal line (no extra narrative).`
    );

    const result = await generateQuietPrompt({
      quietPrompt,
      quietToLoud: true,
      maxTokens: maxTokens ? Number(maxTokens) : 120
    });

    const finalResult = (typeof result === 'string' ? result.trim() : String(result ?? '').trim());
    return finalResult;
  } catch (error) {
    console.error('[Scene Transition] Error generating scene line:', error);
    const testMessage = `[DEBUG] Scene transition test - ${instruction || 'no instruction'} ${style ? `(style: ${style})` : ''}`;
    return testMessage;
  }
}

async function sceneTransitionCallback(named, unnamed) {
  try {
    const instruction = typeof unnamed === 'string' && unnamed.trim() 
      ? unnamed 
      : "Allow the character to transition to a new scene that makes sense.";
    const style = named?.style || undefined;
    const max = named?.max || "120";

    const line = await generateSceneLine({
      instruction,
      style,
      maxTokens: max
    });

    if (line) {
      await insertAssistantMessage(line);
      return "Scene line inserted.";
    }
    return "No output generated.";
  } catch (error) {
    console.error('[Scene Transition] Command execution error:', error);
    return `Error: ${error.message}`;
  }
}

function registerSlashCommand() {
  try {
    SlashCommandParser.addCommandObject(
      SlashCommand.fromProps({
        name: "scene",
        aliases: ["scenecut", "sc"],
        returns: "Insert the next in-character line for a scene transition (OOC prompt hidden)",
        callback: sceneTransitionCallback,
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

function addExtensionMenuButton() {
  // Select the Extensions dropdown menu
  let $extensions_menu = $('#extensionsMenu');
  if (!$extensions_menu.length) {
    return;
  }

  // Create button element with road icon and "Change Scene" text
  let $button = $(`
    <div class="list-group-item flex-container flexGap5 interactable" title="Change Scene" data-i18n="[title]Change Scene" tabindex="0">
      <i class="fa-solid fa-road"></i>
      <span>Change Scene</span>
    </div>
  `);

  // Append to extensions menu
  $button.appendTo($extensions_menu);

  // Set click handler to trigger scene transition
  $button.click(async () => {
    try {
      // Disable button during execution
      $button.addClass('disabled').css('opacity', '0.5');
      
      // Call the scene transition function
      await sceneTransitionCallback({}, "");
      
      // Re-enable button
      $button.removeClass('disabled').css('opacity', '1');
    } catch (error) {
      console.error('[Scene Transition] Extension button error:', error);
      $button.removeClass('disabled').css('opacity', '1');
    }
  });
}

function onReady() {
  registerSlashCommand();
  addExtensionMenuButton();
}

// Initialize the extension when the app is ready
(function() {
  const ctx = getContext();
  if (ctx && ctx.eventSource && ctx.eventTypes) {
    ctx.eventSource.on(ctx.eventTypes.APP_READY, onReady);
  } else {
    // Fallback: try to register immediately if context is available
    onReady();
  }
})();