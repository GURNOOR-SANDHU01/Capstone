# 1\. Multimodal "Expressive" Journaling

Instead of a standard text box, the journaling interface is designed to capture a full emotional spectrum.

* **Audio Entries:** Users can record their thoughts via voice. The system uses **Wav2Vec 2.0** to analyze vocal fatigue/prosody and **ResNet-50** to detect micro-expressions.
* **Real-time Privacy Shield (PII Masking):** To build trust, a "Privacy-First" animation shows the system scrubbing names, locations, and dates locally using **Microsoft Presidio** before the data is processed.
* **AI-Generated Reflection Prompts:** Based on the analyzed emotion, the site generates personalized, **CBT-aligned** prompts to help the user dig deeper into their feelings.

# 2\. "Chat with Your Past" (RAG Interface)

To keep users coming back, the website serves as a searchable memory bank of their personal growth.

* **Semantic History Search:** Users can ask natural language questions like, "When was the last time I felt this anxious about work?".
* **Correlation Discovery:** The AI identifies long-term patterns, such as "You tend to mention 'hiking' on your happiest days" or "Your anxiety spikes whenever you mention 'exams' combined with low sleep".

# 3\. Holistic Health \& Sentiment Dashboard

The platform goes beyond journaling to become a central hub for mental and physical well-being.

* **Biometric Sync \& Visualization:** Integration with **Google Fit/Apple Health** APIs to display sleep patterns and resting heart rate alongside mood data.
* **The "Emotion Scoreboard":** A 360-degree map visualizing the **28 fine-grained emotional states** detected over time, moving beyond simple "happy/sad" labels.
* **Predictive Mood Forecasting:** Using **LSTM/ARIMA** models, the dashboard forecasts potential "emotional dysregulation" based on current sleep and stress trends, acting as an early warning system.

# 4\. Daily Engagement \& "Lively" Features (Gamification)

To ensure the user is motivated to return every day:

* **Intelligent "Nudge" Reminders:** Personalized notifications based on historical "low points" (e.g., a "Sunday Scaries" check-in if the user typically feels anxious on Sunday evenings).
* **Resilience Streaks:** A visual "Resilience Loop" that grows as the user completes daily check-ins or successfully navigates high-stress periods.
* **"Unsent Letter" Vault:** A safe space for users to write letters they never intend to send (to an ex, a late relative, etc.), with the AI providing a "closure analysis" afterward.

# 5\. Intent-Aware Decision Support

* **Vague Intent Translation:** A feature that helps users articulate unclear feelings. If a user says, "I feel weird today," the **Transformer-based** intent layer asks clarifying questions to convert vague input into a structured emotional state.
* **Personalized Interpretation Layer:** The system learns the user's "baseline" over time, distinguishing between what is "normal" for them versus what is an unusual emotional spike.

# 6\. Safety \& The "Therapist Bridge"

* **Clinician Portal:** A B2B dashboard where therapists (with user consent) can view longitudinal data summaries and "Red Flag Alerts" for severe behavioral drifts.
* **Red Zone Mode:** An automated intervention system that, if sustained emotional decline is detected, offers immediate resources or contacts a pre-set trusted contact.

# 7\. Additional Features

* adding wearable api
* adding meta-human figure(for giving output to user) using unreal engine

# What we will evaluate

* How accurately the system understands user intent
* Whether personalization improves relevance over time
* Whether generated outputs match the original intent

# What this project is not claiming

* It does not replace professionals
* It does not give medical or architectural advice
* It is a decision-support and exploration tool

