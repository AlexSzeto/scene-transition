# Scene Transition Extension

The Scene Transition Extension for SillyTavern allows characters to automatically initiate scene transitions without user input. This extension provides an easy way to move conversations to new locations, settings, or situations while maintaining narrative flow and character consistency.

## Features

- **Automatic Scene Transitions**: Generate contextual scene changes that make sense within the current conversation
- **Background Image Generation**: Optional integration with stable-diffusion extension for automatic background updates
- **Customizable Instructions**: Tailor the AI's scene transition behavior to your preferences

## How to Use

### Method 1: Slash Command

Use the `/scene` command (or its aliases `/scenecut` or `/sc`) to trigger a scene transition:

```
/scene
```

You can also override the global background generation setting:

```
/scene background=true
/scene background=false
```

### Method 2: Extension Button

1. Use the magic wand next to the chat input window.
2. Click the **"Change Scene"** button (with a road icon)
3. The extension will automatically ask the AI to insert a scene transition message

## How It Works

The Scene Transition Extension operates by:

1. **Context Analysis**: Examining the current conversation to understand the story state
2. **Quiet Prompt Generation**: Sending a hidden system prompt to instruct the AI to change scene.
4. **Message Insertion**: Adding the generated scene transition as a character message
5. **Optional Background**: Triggering background image generation if enabled and configured

## Limitations

- **Swipe Sensitivity**: If you use the swipe feature to regenerate responses after a scene transition, the scene change context will be lost
- **Background Generation**: The current implementation is a bit hacky (it literally clicks the Generate Background menu option with code)
- **Limited Testing**: The existing instruction was only tested on various flavors of MistralNeMo and its remixes, and might need to be rewritten completely for other LLMs.

## Customization Options

### Scene Transition Instructions

The extension allows you to customize the instructions given to the AI for generating scene transitions. 

### Background Image Generation

Control whether scene transitions automatically trigger background image generation. This requires the `stable-diffusion` to be setup and ready to use.

**Note**: You can override this setting per-command using the `background=true/false` parameter with the `/scene` slash command.

## Installation

1. Install this extension using the following URL: `https://github.com/AlexSzeto/scene-transition`

---

*Enhance your storytelling experience with seamless scene transitions that keep your conversations dynamic and engaging!*