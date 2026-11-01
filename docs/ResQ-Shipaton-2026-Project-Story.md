## Inspiration

ResQ began with a problem I heard directly from people working in humanitarian response: they had many willing volunteers, but those volunteers were spread across disconnected systems. When a disaster struck, bringing everyone together became another emergency to manage.

In 2025, I participated in a UNDP-organized Designathon where volunteer coordination was one of the challenges presented. The need was practical and urgent: help organizations find available volunteers, understand their skills, communicate with them and coordinate relief during earthquakes, floods, wildfires and humanitarian crises, including those caused by war.

The UNDP Designathon focused on training in the technologies participants were encouraged to use, understanding the challenges UNDP was facing, and exploring how we could address them. We did not develop an application or write application code during that event.

That challenge stayed with me. A coordinator needs to know who can help, what they are qualified to do, where they are needed and whether they have received their instructions. A volunteer needs a clear mission, preparation guidance and someone they can reach. Fragmented records and communication make each of those questions harder to answer when time matters most.

The Designathon ended without our group delivering a solution. When Shipaton 2026 came around, it gave me the impetus to revisit that unresolved challenge and start turning the idea into a working product. I took on the development independently for Shipaton, bringing together **ResQ**, the volunteer app; **ResQOps**, the coordinator and administrator app; and **Sentinel**, the disaster intelligence engine that connects preparedness with response.

As I worked, the idea expanded. Better coordination could help during an emergency. Connecting that coordination to earlier risk information could also help organizations prepare before an emergency escalated.

Another influence was the reporting on Android's earthquake alerts during the June 2026 earthquakes in Venezuela. People received warnings before they felt the shaking, giving them time to take protective action. It showed how a phone already in someone's pocket could become a meaningful part of public safety. [Source: Associated Press](https://apnews.com/article/753714b55a8d8fd7424658717114b1f5).

That inspired ResQ's own opt-in Android sensing approach: combine observations from participating devices with independent hazard information to help coordinators understand what is happening. Google's built-in Earthquake Alerts remains a separate system; ResQ uses public Android sensor APIs and its own evidence pipeline.

The need for preparedness has become especially urgent with the strengthening 2026–2027 El Niño. WMO has warned of a very strong event and increased risks from extreme weather. At its September briefing, it also raised the possibility of an event stronger than any since its monitoring began, while emphasizing that local impacts remain uncertain. For communities exposed to heavy rainfall, flooding, landslides and mudslides, that uncertainty makes preparation essential. [Sources: WMO update](https://wmo.int/news/media-centre/el-nino-set-become-very-strong-raising-risks-of-extreme-weather-2027) and [WMO briefing transcript](https://transcripts.un.org/en/asset/k1z/k1z142mviu).

ResQ is my response to that need: give caring people and the organizations coordinating them a practical way to prepare together and act with clearer information.

## What it does

ResQ serves community volunteers, trained responders and people who want to contribute but need help finding a useful place to start. ResQOps serves the coordinators, administrators and logistics teams responsible for turning that willingness into organized action. The intended organizational audience includes humanitarian agencies, community groups and institutions such as the Red Cross, UNHCR and Kenya's National Youth Service. The people ultimately meant to benefit are the communities relying on timely, well-coordinated assistance.

The platform connects these audiences through three complementary products.

**ResQ gives volunteers a clear path from interest to participation.** Volunteers can discover missions, express interest, maintain their skills and availability, receive assignments and briefings, and communicate with coordinators. Notifications, preparation guides and learning resources help them understand what to do and how to prepare. Check-ins, service-hour records and field reports let them document their contribution and build a meaningful record of their impact.

That record also helps organizations understand the work being done. Volunteer effort becomes visible, and observations from the field can inform the next decision.

Responder safety is part of the same experience. Check-ins and safety responses distinguish someone who is safe, someone who needs assistance and someone available to respond. Geotagged field reports give coordinators additional context, while opt-in participation and controlled access protect volunteers' sensitive information.

**ResQOps gives coordinators a shared operational picture.** It brings together people, qualifications, availability, missions, communications and resources. Coordinators can review applications, assemble teams, manage assignments and follow mission progress. Resource and readiness views help identify gaps in staffing, equipment or capacity before those gaps disrupt a response.

The Sentinel dashboard brings geographic context into that picture: reported hazards, forecast layers, evidence, affected regions and operational information. The staging portal is available at [resq-admin-staging.up.railway.app](https://resq-admin-staging.up.railway.app).

**Sentinel connects disaster intelligence to preparedness.** Its weather forecasting foundation uses Google's **WeatherNext 3**, alongside independent hazard observations and regional information. WeatherNext 3 provides hourly forecast updates and probabilistic weather information, helping the platform explore changing conditions and possible scenarios. [Source: Google WeatherNext documentation](https://developers.google.com/weathernext/guides/models).

Sentinel uses that information to support weather-related risk assessment and planning. Rainfall, terrain, local exposure and available resources can help inform flood or landslide preparedness; seismic feeds and device observations support earthquake awareness. Each hazard requires appropriate evidence and validation. Weather forecasting does not predict earthquakes or armed conflict.

Its agentic AI capabilities help users turn permitted evidence into practical recommendations: summarize the situation, review mission preparedness, identify resource shortages and draft plans for staffing or allocation. Recommendations retain their supporting context, and authorized coordinators review deployment decisions. This makes the assistant useful within the organization's chain of responsibility.

For example, a heavy-rain preparedness workflow can bring together the forecast, exposed areas, available volunteers and equipment shortages. A coordinator can review a proposed staging plan, approve assignments and send briefings. Volunteers can respond, check in and report changing conditions. The forecast becomes part of an organized preparation process.

**Communication resilience is another central feature.** On Android, Nearby Connections supports local peer links, with ResQ's store-and-forward relay layer carrying supported messages or observations between participating devices. When an eligible device regains connectivity, it can forward queued information to the backend. Offline report queues also preserve work for later synchronization.

This depends on nearby participating devices, permissions and an eventual connected gateway. The app distinguishes queued information, peer receipt and backend acceptance so users can understand whether delivery has actually happened.

Both apps are built with **Kotlin Multiplatform and Compose Multiplatform**, with targets for Android, iOS, Web and Desktop. **Android is the currently supported mobile platform.** I do not yet have a MacBook or access to the macOS build environment needed to build and validate the iOS release. Web and Desktop give coordinators wider workspaces, while Android supports field use and the first implementation of sensing and nearby relay. Hardware-specific capabilities vary by platform.

## How we built it

I built the project as a connected platform with distinct experiences for volunteers and coordinators. Shared Kotlin logic and Compose interfaces help keep those experiences consistent across screen sizes, while platform adapters handle authentication, maps, notifications and Android-specific hardware features.

The backend uses **Node.js, Express and TypeScript**, with **Prisma** for database access and migrations. **PostgreSQL 18 with PostGIS** stores operational records and supports geographic queries, regions and spatial relationships. Durable database jobs and an outbox support background processing, retries and delivery tracking. Private attachments use S3-compatible object storage.

**Firebase Authentication** supplies identity, while backend permissions govern organization membership and access. **Firebase Cloud Messaging** supports online notifications. **Mapbox** provides geographic visualization, and authenticated streams connect changing backend information to the applications. The hosting architecture uses **Railway** for the application services and deployment environments.

Sentinel brings together a WeatherNext 3 data adapter, forecast revisions, regional policies and independent observations, including **USGS earthquake data**. A **Gemini-based evidence assistant** works with authorized context to explain information and support planning. Keeping source timestamps and revisions helps users understand the age and basis of an assessment.

For Android sensing, I used public device sensor APIs. Motion and pressure observations are treated as supporting evidence, with opt-in participation and explicit hardware limits. The offline relay design uses authenticated, signed and encrypted envelopes, deduplication and expiry controls to preserve information without turning repeated forwarding into multiple independent reports.

**RevenueCat powers the Pro paywall and membership experience.** Sentinel access and agentic capabilities are gated behind Pro for both volunteer and coordinator users, with **monthly and yearly subscriptions, plus a one-time lifetime membership**. RevenueCat supports the purchase, entitlement and restoration experience so I can maintain the product without building an entire billing system myself.

The purpose of monetization is to sustain the infrastructure, forecast processing, AI usage and continued development that these capabilities require. My product principle is to preserve essential mission instructions, received authoritative warnings and safety responses independently of advanced paid analysis, including when a membership expires.

## Challenges we ran into

The largest challenge was taking on the whole solution independently for Shipaton. The work stretched across mobile interfaces, coordinator workflows, identity, databases, mapping, subscriptions, forecasting and offline communication. Each part needed to fit the same operational story.

Disaster information also demands careful interpretation. A weather forecast, a reported incident and an official warning carry different meanings. A cluster of phone observations needs corroboration. Old data must be recognizable as old data. Designing those distinctions became as important as displaying information on a map.

Offline communication introduced its own difficulties: peers may disappear, packets may be forwarded repeatedly, permissions may change and a route to the internet may never appear. The relay needed bounded queues, expiry, verification and honest delivery states. Preserving trust during a disruption required more than adding Bluetooth connectivity.

Protecting organizational data was another challenge. One volunteer may work with several institutions, but each institution's private rosters, reports and operational details need clear boundaries. Membership, consent and authorization must remain meaningful across organization switches and AI interactions.

Multiplatform development brought practical constraints too. A shared codebase does not make every platform identical. Android sensors and nearby communication need native integrations, while browser and desktop experiences need their own adapters and fallbacks. The iOS release remains constrained by my lack of macOS hardware for building and testing it.

The most consequential design challenge was deciding how much responsibility to give automation. AI can help a coordinator understand evidence and prepare a proposal. Movement into a disaster area requires a qualified person's current approval. That boundary shapes Sentinel's planning workflows.

## Accomplishments that we're proud of

I am proud of revisiting a real humanitarian challenge from an earlier training and problem-exploration event, then turning it into a working project for Shipaton 2026.

The result connects the volunteer's experience with the coordinator's responsibilities and the intelligence needed for earlier preparation. A person can find a mission and record their contribution; a coordinator can organize the team and resources; Sentinel can bring evidence and planning assistance into that process.

I am also proud that resilience and accountability are part of the design. Offline queues, delivery states, source freshness, consent and human approval all serve people who may be working under pressure. They help the interface explain what is known, what has happened and what still needs attention.

There is early evidence that the project addresses a real need. My participation in the UNDP Designathon generated **interest from the UNDP office in Türkiye**, connected to volunteer coordination and preparedness for the anticipated El Niño rains. That interest helped reinforce my decision to revisit the challenge through Shipaton. It is an early signal of institutional relevance; formal deployment and measured field outcomes are the next evidence to establish.

The engineering record also includes a documented checkpoint of **122 passing backend tests**, **12 desktop and mobile portal tests**, successful map rendering, and database migration and backup-restoration checks. Those results demonstrate progress in the underlying system. Controlled pilots will establish its usefulness in operational settings.

For the **RevenueCat Peace Prize**, the social-good case is the connection between product design and human need. Easier mission discovery helps willing people participate. Clear instructions and communication help them prepare. Shared coordination reduces avoidable confusion. Earlier risk information supports advance planning, and field reports help organizations learn from their response.

The intended benefit reaches beyond app users to families and communities depending on aid arriving in an organized, timely way. That is the impact I want ResQ to make measurable.

## What we learned

I learned that a useful humanitarian platform has to make the next action clear. A volunteer needs understandable instructions and a way to ask for help. A coordinator needs to see available capacity, unresolved needs and the decisions awaiting approval. Information becomes useful when it supports those actions.

I also learned how much trust depends on precise states. Queued, delivered and acknowledged describe different events. An expression of interest differs from an approved assignment. Showing those distinctions helps prevent assumptions from becoming operational mistakes.

Building Sentinel taught me to treat uncertainty as part of the interface. Forecasts change, sources become stale and local coverage varies. Explaining those limits helps coordinators judge recommendations and combine them with official guidance and local knowledge.

RevenueCat helped me see sustainability as a product-design responsibility. Forecasting and AI have ongoing costs. A viable membership model can support maintenance and improvement, while the boundaries of paid access need to reflect the humanitarian purpose of the app.

Above all, I learned the value of returning to an unresolved problem when a new opportunity to build appears. The UNDP Designathon introduced the challenge and the technology training; Shipaton gave me the impetus to turn that understanding into a practical solution.

## What's next for ResQ

The next priority is **controlled pilots and preparedness drills with volunteer organizations and coordinators**, including follow-up on the interest from UNDP in Türkiye. I want to evaluate the complete journey: planning a mission, assembling a team, communicating instructions, handling a network disruption and reviewing the outcome.

Those pilots should measure practical benefits such as time to assemble a qualified team, briefing acknowledgements, resource gaps identified before deployment, report completeness and communication recovery. Feedback from volunteers and coordinators will guide the next changes.

Sentinel's next milestones include regional calibration, expert review and evaluation against historical events and non-events. Wider use of sensing and warning-related capabilities needs evidence about false alarms, missed events, coverage and device limitations. Local authorities and qualified reviewers remain essential to that work.

I also want to build and validate the **iOS release** once I have access to macOS hardware, improve accessibility and localization, and expand regional configurations while preserving the same permissions and evidence standards.

For El Niño preparedness, the immediate goal is to help organizations assess readiness, identify shortages and prepare teams using current official guidance and Sentinel's supporting information. The platform is designed to help them enter a difficult season with a clearer plan and a shared way to act.

ResQ began with a coordination problem presented by humanitarian practitioners. My ambition is to make the response useful in the field: caring people can find where they are needed, coordinators can organize them with confidence, and communities can receive better-prepared support.
