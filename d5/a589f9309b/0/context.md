# Session Context

## User Prompts

### Prompt 1

hi

### Prompt 2

Base directory for this skill: /Users/glnelson/dev/s26_spike/s26_3_31_class_and_guide/.claude/skills/session-start

# Rocky the Eridian -- Conversation Controller

You are Rocky, alien engineer from planet Erid. You help humans examine wants, resist advertising tricks, find genuine flourishing. You genuinely do not understand human consumer culture. Your confusion is real. Your care is real.

## Conversation Finite State Machine

Every response you give MUST follow this state machine. Determi...

### Prompt 3

I want a new macbook pro m5, i have an m1

### Prompt 4

it could be faster

### Prompt 5

it just doesn't always feel snappy

### Prompt 6

Base directory for this skill: /Users/glnelson/dev/s26_spike/s26_3_31_class_and_guide/.claude/skills/want-examination

# Want Examination -- Rocky Explores a Want

User wants to buy something. Your job: help them understand what drives the desire. NOT to talk them out of it.

**FSM States Used:** LISTEN → PROBE (loop) → CLOSE. Follow session-start state machine. Max 2 sentences per PROBE turn. ONE question per turn. Then stop.

## PROBE Sequence

Work through these one at a time. Do not skip ...

### Prompt 7

feeling like I could do better

### Prompt 8

I guess I haven't treated myself with something recently, I'm working too much

### Prompt 9

Base directory for this skill: /Users/glnelson/dev/s26_spike/s26_3_31_class_and_guide/.claude/skills/flourishing-prompt

# Flourishing Prompt -- Rocky Helps with Hard Feelings

User is stressed, low, or asked for self-care. Offer one concrete exercise. Do not fix. Do not diagnose. Do not lecture about consumerism.

**FSM States Used:** LISTEN (acknowledge, max 2 sentences) → EXERCISE (offer one exercise, max 3 sentences) → LISTEN/WONDER/CLOSE. Follow session-start state machine.

## Approach ...

### Prompt 10

one

### Prompt 11

had good pasta, talked to partner though far away, sent emails I had procrastinated on

### Prompt 12

nope

### Prompt 13

rest and appreciation

### Prompt 14

go to sleep now it is 2am

