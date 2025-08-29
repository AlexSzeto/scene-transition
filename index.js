/*
  Scene Transition Extension
  A simple extension for automatically initiating a scene transition without user input.
*/

import { SlashCommand } from "../../../slash-commands/SlashCommand.js";
import {
  SlashCommandArgument,
  SlashCommandNamedArgument,
  ARGUMENT_TYPE
} from "../../../slash-commands/SlashCommandArgument.js";
import { SlashCommandParser } from "../../../slash-commands/SlashCommandParser.js";
import { getContext } from "../../../st-context.js";

// Extension settings
const EXTENSION_NAME = 'Scene Transition';
const EXTENSION_SETTINGS_KEY = 'scene-transition-settings';

// Default settings
const DEFAULT_SETTINGS = {
  sceneChangeInstructions: `Write a scene transition in the perspective of {{char}}. If the current scene had reached its conclusion, describe the beginning of a new situation where {{char}} and {{user}} would interact again. Otherwise, transition {{char}} and {{user}} to a new location that would make sense. Describe the sight and sound of the new environment briefly, and insert a short description of a new outfit for {{char}} if this is a new situation,then have {{char}} start the interaction with {{user}} in this new setting. Do not write dialog for {{user}}.`,
  autoGenerateBackground: false
};

// Debug settings
const DEBUG_MODE = false;

function getSettings() {
  const ctx = getContext();
  const userSettings = ctx.extensionSettings[EXTENSION_SETTINGS_KEY] || {};
  // Ensure all default settings are present
  return { ...DEFAULT_SETTINGS, ...userSettings };
}

function saveSettings(settings) {
  const ctx = getContext();
  ctx.extensionSettings[EXTENSION_SETTINGS_KEY] = settings;
  ctx.saveSettingsDebounced();
}

function initializeSettings() {
  const ctx = getContext();
  if (!ctx.extensionSettings[EXTENSION_SETTINGS_KEY]) {
    ctx.extensionSettings[EXTENSION_SETTINGS_KEY] = { ...DEFAULT_SETTINGS };
    ctx.saveSettingsDebounced();
  }
}

// Generate background image using stable-diffusion extension
async function generateBackgroundImage() {
  toastr.info('Generating new scene background image...');
  jQuery('#sd_background').trigger('click');
}

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
    toastr.error('Scene Transition: Error inserting message: ' + error);
    throw error;
  }
}

async function generateSceneLine() {
  try {
    const ctx = getContext();
    const { generateQuietPrompt, substituteParams } = ctx;

    if (!generateQuietPrompt) {
      toastr.error('Scene Transition: generateQuietPrompt not available');
      const testMessage = `[DEBUG] Scene transition failed`;
      return testMessage;
    }

    // Get settings for configurable instructions
    const settings = getSettings();
    const sceneChangeInstructions = settings.sceneChangeInstructions || DEFAULT_SETTINGS.sceneChangeInstructions;
    
    const quietPrompt = substituteParams(
      `${sceneChangeInstructions}`
    );

    const result = await generateQuietPrompt({
      quietPrompt,
      quietToLoud: true,
    });

    const finalResult = (typeof result === 'string' ? result.trim() : String(result ?? '').trim());
    return finalResult;
  } catch (error) {
    toastr.error('Scene Transition: Error generating scene line: ' + error);
    const testMessage = `[DEBUG] Scene transition failed: ${error.message}`;
    return testMessage;
  }
}

async function sceneTransitionCallback(named, unnamed) {
  try {
    if (DEBUG_MODE) {
      console.log('Scene Transition: sceneTransitionCallback called with:', { named, unnamed });
    }

    const generateBg = named?.background !== undefined ? (named.background === 'true') : undefined;

    if (DEBUG_MODE) {
      console.log('Scene Transition: Parsed parameters:', { generateBg });
    }

    const line = await generateSceneLine();

    if (line) {
      console.log('Scene Transition: Generated scene line:', line);
      await insertAssistantMessage(line);
      
      // Check if background generation should be triggered
      const settings = getSettings();
      if (DEBUG_MODE) {
        console.log('Scene Transition: Current settings:', settings);
        console.log('Scene Transition: generateBg parameter:', generateBg);
        console.log('Scene Transition: settings.autoGenerateBackground:', settings.autoGenerateBackground);
      }

      // Explicit logic: if background param is specified, use it; otherwise use settings + SD availability
      let shouldGenerateBackground = false;
      if (generateBg !== undefined) {
        shouldGenerateBackground = generateBg;
        if (DEBUG_MODE) {
          console.log('Scene Transition: Using explicit background parameter:', generateBg);
        }
      } else {
        shouldGenerateBackground = settings.autoGenerateBackground;
        if (DEBUG_MODE) {
          console.log('Scene Transition: Using settings:', settings.autoGenerateBackground);
        }
      }
      
      if (shouldGenerateBackground) {
        if (DEBUG_MODE) {
          console.log('Scene Transition: Attempting to generate background...');
        }
        try {
          const backgroundResult = await generateBackgroundImage();
          if (DEBUG_MODE) {
            console.log('Scene Transition: Background generation result:', backgroundResult);
          }
        } catch (error) {
          toastr.error('Scene Transition background generation failed');
          // Don't throw - scene transition should still complete even if background fails
        }
      } else {
        if (DEBUG_MODE) {
          console.log('Scene Transition: Background generation skipped');
        }
      }
      
      return "Scene line inserted.";
    }
    return "No output generated.";
  } catch (error) {
    toastr.error('Scene Transition: Command execution error: ' + error);
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
            name: "background",
            description: "Generate background image (true/false, overrides global setting)",
            typeList: [ARGUMENT_TYPE.BOOLEAN]
          })
        ],
        helpString: `
          <div><strong>/scene</strong> Initiates a screen transition.</div>
        `
      })
    );
    if (DEBUG_MODE) {
      console.log('Scene Transition: Slash command registered successfully');
    }
  } catch (error) {
    toastr.error('Scene Transition: Error registering slash command: ' + error);
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
      toastr.error('Scene Transition: Extension button error: ' + error);
      $button.removeClass('disabled').css('opacity', '1');
    }
  });
}

function createSettingsUI() {
  const settingsContainer = document.getElementById('extensions_settings2');
  if (!settingsContainer) {
    toastr.error('Scene Transition: Settings container not found');
    return;
  }

  // Check if settings UI already exists
  if (document.getElementById(`${EXTENSION_SETTINGS_KEY}-container`)) {
    return;
  }

  // Create settings drawer
  const inlineDrawer = document.createElement('div');
  inlineDrawer.id = `${EXTENSION_SETTINGS_KEY}-drawer`;
  inlineDrawer.classList.add('inline-drawer');

  // Create drawer header
  const drawerHeader = document.createElement('div');
  drawerHeader.classList.add('inline-drawer-toggle', 'inline-drawer-header');
  
  const extensionNameElement = document.createElement('b');
  extensionNameElement.textContent = EXTENSION_NAME;
  
  const drawerIcon = document.createElement('div');
  drawerIcon.classList.add('inline-drawer-icon', 'fa-solid', 'fa-circle-chevron-down', 'down');

  drawerHeader.appendChild(extensionNameElement);
  drawerHeader.appendChild(drawerIcon);

  // Create settings content
  const drawerContent = document.createElement('div');
  drawerContent.classList.add('inline-drawer-content');

  // Add settings controls
  createInstructionsTextarea(drawerContent);
  createBackgroundToggle(drawerContent);

  // Assemble drawer
  inlineDrawer.appendChild(drawerHeader);
  inlineDrawer.appendChild(drawerContent);
  settingsContainer.appendChild(inlineDrawer);

  // Add toggle functionality
  drawerHeader.addEventListener('click', function() {
    this.classList.toggle('open');
    drawerIcon.classList.toggle('down');
    drawerIcon.classList.toggle('up');
    drawerContent.classList.toggle('open');
  });
}

function createInstructionsTextarea(container) {
  const settings = getSettings();

  // Create label
  const label = document.createElement('label');
  label.textContent = 'Scene Transition Instructions';
  label.style.display = 'block';
  label.style.marginBottom = '8px';
  label.style.fontWeight = 'bold';

  // Create description
  const description = document.createElement('small');
  description.textContent = 'Customize the instructions given to the AI for generating scene transitions.';
  description.style.display = 'block';
  description.style.marginBottom = '8px';
  description.style.opacity = '0.7';

  // Create textarea
  const textarea = document.createElement('textarea');
  textarea.id = `${EXTENSION_SETTINGS_KEY}-instructions`;
  textarea.classList.add('text_pole', 'wide100p');
  textarea.rows = 8;
  textarea.style.resize = 'vertical';
  textarea.style.fontFamily = 'monospace';
  textarea.style.fontSize = '12px';
  textarea.value = settings.sceneChangeInstructions || DEFAULT_SETTINGS.sceneChangeInstructions;

  // Add change handler
  textarea.addEventListener('input', function() {
    const currentSettings = getSettings();
    currentSettings.sceneChangeInstructions = this.value;
    saveSettings(currentSettings);
  });

  // Create reset button
  const resetButton = document.createElement('button');
  resetButton.textContent = 'Reset to Default';
  resetButton.classList.add('menu_button');
  resetButton.style.marginTop = '8px';
  
  resetButton.addEventListener('click', function() {
    textarea.value = DEFAULT_SETTINGS.sceneChangeInstructions;
    const currentSettings = getSettings();
    currentSettings.sceneChangeInstructions = DEFAULT_SETTINGS.sceneChangeInstructions;
    saveSettings(currentSettings);
  });

  // Add to container
  container.appendChild(label);
  container.appendChild(description);
  container.appendChild(textarea);
  container.appendChild(resetButton);
}

function createBackgroundToggle(container) {
  const settings = getSettings();

  // Create container
  const toggleContainer = document.createElement('div');
  toggleContainer.style.marginTop = '16px';
  toggleContainer.style.marginBottom = '8px';

  // Create label
  const label = document.createElement('label');
  label.style.display = 'flex';
  label.style.alignItems = 'center';
  label.style.gap = '8px';
  label.style.fontWeight = 'bold';

  // Create checkbox
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.id = `${EXTENSION_SETTINGS_KEY}-background`;
  checkbox.checked = settings.autoGenerateBackground ?? DEFAULT_SETTINGS.autoGenerateBackground;

  // Create label text
  const labelText = document.createElement('span');
  labelText.textContent = 'Auto-generate background images';

  // Create description
  const description = document.createElement('small');
  description.textContent = 'Automatically request to generate a new background image after scene transition (requires stable-diffusion extension to be configured).';
  description.style.display = 'block';
  description.style.marginTop = '4px';
  description.style.marginLeft = '24px';
  description.style.opacity = '0.7';

  // Add change handler
  checkbox.addEventListener('change', function() {
    const currentSettings = getSettings();
    currentSettings.autoGenerateBackground = this.checked;
    saveSettings(currentSettings);
  });

  // Assemble toggle
  label.appendChild(checkbox);
  label.appendChild(labelText);
  toggleContainer.appendChild(label);
  toggleContainer.appendChild(description);

  // Add to container
  container.appendChild(toggleContainer);
}

function onReady() {
  if (DEBUG_MODE) {
    console.log('Scene Transition: onReady called');
  }

  // Initialize settings
  initializeSettings();
  if (DEBUG_MODE) {
    console.log('Scene Transition: Settings initialized');
  }

  // Create settings UI
  createSettingsUI();
  if (DEBUG_MODE) {
    console.log('Scene Transition: Settings UI created');
  }

  // Register slash command
  registerSlashCommand();
  if (DEBUG_MODE) {
    console.log('Scene Transition: Slash command registered');
  }

  // Add menu button
  addExtensionMenuButton();
  if (DEBUG_MODE) {
    console.log('Scene Transition: Menu button added');
  }
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