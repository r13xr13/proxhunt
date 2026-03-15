---
name: proton-mail
description: Proton Mail for registration and verification
version: 1.0.0
---

# Proton Mail Skill

Manage Proton Mail for registrations and verifications.

## Tools

[[tool]]
name: proton_register
description: Register a Proton Mail account
params:
  - name: username
    type: string
    required: true
    description: Desired username
  - name: password
    type: string
    required: true
    description: Account password

[[tool]]
name: proton_login
description: Get Proton Mail login
params: []

[[tool]]
name: proton_verify
description: Get verification code
params: []

## Script

function proton_register({ username, password }) {
  return {
    note: 'Proton Mail requires manual registration',
    url: 'https://account.proton.me/mail/signup',
    username,
    tip: 'Use username@proton.me format',
    verification: 'Check your recovery email for code'
  };
}

function proton_login() {
  return {
    url: 'https://account.proton.me/mail',
    note: 'Login manually at Proton Mail',
    two_factor: 'Enable 2FA for security'
  };
}

function proton_verify() {
  return {
    note: 'Verification codes arrive in inbox',
    recovery: 'Set up recovery email for backup'
  };
}
