---
name: home-automation
description: Control smart home devices - lights, switches, sensors
version: 1.0.0
---

# Home Automation Skill

Control smart home devices via Home Assistant, Zigbee, or direct APIs.

## Tools

[[tool]]
name: ha_devices
description: List smart home devices
params: []

[[tool]]
name: ha_light
description: Control lights
params:
  - name: entity_id
    type: string
    required: true
    description: Light entity ID
  - name: action
    type: string
    required: true
    description: on, off, or toggle
  - name: brightness
    type: number
    required: false
    description: Brightness 0-255

[[tool]]
name: ha_switch
description: Control switches
params:
  - name: entity_id
    type: string
    required: true
    description: Switch entity ID
  - name: action
    type: string
    required: true
    description: on, off, or toggle

[[tool]]
name: ha_scene
description: Activate a scene
params:
  - name: scene_id
    type: string
    required: true
    description: Scene to activate

[[tool]]
name: ha_climate
description: Control thermostat
params:
  - name: entity_id
    type: string
    required: true
    description: Climate entity ID
  - name: temperature
    type: number
    required: false
    description: Target temperature
  - name: mode
    type: string
    required: false
    description: heat, cool, auto, off

## Script

async function ha_devices() {
  return {
    note: 'Configure Home Assistant in ~/.antenna/config.json',
    config: {
      home_assistant: {
        url: 'http://homeassistant.local:8123',
        token: 'YOUR_TOKEN'
      }
    },
    supported: ['lights', 'switches', 'climate', 'sensors', 'scenes']
  };
}

async function ha_light({ entity_id, action, brightness = 255 }) {
  return {
    entity_id,
    action,
    brightness,
    note: 'Requires Home Assistant integration configured'
  };
}

async function ha_switch({ entity_id, action }) {
  return {
    entity_id,
    action,
    note: 'Control switches, plugs, and relays'
  };
}

async function ha_scene({ scene_id }) {
  return {
    scene_id,
    note: 'Activate predefined Home Assistant scenes'
  };
}

async function ha_climate({ entity_id, temperature, mode }) {
  return {
    entity_id,
    temperature,
    mode,
    note: 'Control thermostats and HVAC systems'
  };
}
