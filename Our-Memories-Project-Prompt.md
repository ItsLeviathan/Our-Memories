# Our Memories — Full Project Build Prompt

## Project Overview

Build a private, modern, responsive photo-memory website for two people: me and my girlfriend.

The core idea is a shared digital memory space where we can upload photos throughout each month, organize them into monthly collections, view them in high quality, and automatically create a video recap at the end of every month.

The product should feel like a **premium private digital photo journal**, not a generic SaaS dashboard and not a social media platform.

The experience should be:

> **Modern + minimal + cinematic + personal**

Think of the visual quality and simplicity of modern Apple-style products, combined with an editorial photography website and a private digital scrapbook.

Do not make the design cheesy or overly romantic. Avoid filling the interface with hearts, pink gradients, excessive animations, or decorative elements. The photographs should remain the visual focus.

---

# 1. Core Concept

The application has two different experiences:

### Private Management Experience

Only me and my girlfriend can log in.

Authenticated users can:

- Upload photos
- View all memories
- Edit memory information
- Delete memories
- Add captions
- Favorite memories
- View monthly collections
- Generate monthly recaps
- Download high-quality photos
- Download generated recap videos
- Manage sharing links

### Public Viewing Experience

A person does NOT need an account to view a shared monthly memory collection if they have its private share link.

For example:

`https://domain.com/m/<secure-share-token>`

A public visitor can:

- View the shared month's photos
- View the month information
- Watch the monthly recap if available
- Download/view content only according to the share permissions

A public visitor must NOT be able to:

- Upload
- Edit
- Delete
- Generate recaps
- Access the private dashboard
- Access authentication-only features
- Access other months unless they have a valid share link for those months

The public page should feel like a beautiful digital photo album, not an administration page.

---

# 2. Recommended Technology Architecture

Use the following architecture unless there is a strong technical reason to improve it.

## Frontend / Web Application

- Next.js
- TypeScript
- React
- Modern CSS architecture or Tailwind CSS
- Responsive design
- Framer Motion or an appropriate lightweight animation library where useful

Deploy the web application on:

- Vercel

## Authentication

Use:

- Supabase Auth

Only the two authorized users should have accounts.

Do not implement public registration.

The login page should be clean and minimal.

## Database

Use:

- Supabase PostgreSQL

Supabase should store application metadata rather than large media files.

Example data:

- users
- couple/space
- memories
- months
- captions
- favorites
- share links
- recap records
- upload metadata
- generation status

Use:

- Row Level Security
- authenticated access policies
- proper ownership checks

Never rely only on frontend checks for security.

## Media Storage

Use:

- Cloudflare R2

Use R2 for:

- optimized photos
- HD photos
- generated monthly recap videos

The goal is to keep large media separate from the relational database.

The system should not store original phone photos if the optimized high-quality version is sufficient.

---

# 3. Photo Upload and Optimization

Users should be able to upload photos from:

- Desktop
- Laptop
- Mobile browser
- Tablet

Support multiple photo uploads.

The upload experience should be modern and easy.

Example:

> Add to our memories  
> Drop photos here or choose from your device

After selecting photos, display previews before uploading.

The user should be able to enter:

- Date
- Caption
- Optional location
- Optional tags
- Favorite status

The system should preserve useful photo information such as capture date when available.

## Image Processing

Do not blindly store the original phone file.

Process the image before permanent storage.

Recommended behavior:

1. Receive uploaded image
2. Validate file type and size
3. Process and optimize image
4. Resize if necessary
5. Preserve good visual quality
6. Generate optimized viewing version
7. Generate HD version
8. Upload processed versions to R2
9. Store metadata in Supabase
10. Remove temporary files

Target a maximum useful resolution rather than keeping unnecessarily huge files.

For example:

- Longest side around 2560px for HD viewing
- Use a modern image format when appropriate
- Maintain visually high quality
- Avoid aggressive compression
- Do not make images visibly blurry or pixelated

The user should feel like they are viewing the original-quality memory even though the file has been optimized.

---

# 4. Storage Strategy

The storage system should conceptually look like:

```text
Phone / Computer
        |
        v
    Upload API
        |
        v
 Image Processing
        |
        +------> Optimized image
        |
        +------> HD image
        |
        v
    Cloudflare R2
        |
        v
 Supabase stores metadata
```

Do not put large binary media directly into PostgreSQL.

Do not expose private storage credentials to the browser.

Use secure server-side handling and signed URLs where appropriate.

Never expose:

- R2 secret keys
- Supabase service-role key
- other privileged credentials

to client-side code.

---

# 5. Memory Data Model

Design a clean relational schema.

At minimum, support concepts similar to:

## couples / spaces

Represents the shared private memory space.

Possible fields:

- id
- name
- created_at

## profiles

Represents the two authenticated users.

Possible fields:

- id
- user_id
- display_name
- avatar
- created_at

## memories

Possible fields:

- id
- couple_id
- uploaded_by
- captured_at
- created_at
- caption
- location
- is_favorite
- status
- month_key

## memory_assets

Possible fields:

- id
- memory_id
- storage_key
- asset_type
- width
- height
- file_size
- mime_type
- created_at

Support multiple assets per memory if needed.

## monthly_recaps

Possible fields:

- id
- couple_id
- month_key
- status
- video_storage_key
- duration
- generated_at
- error_message
- updated_at

Possible statuses:

- not_generated
- queued
- processing
- ready
- failed

## share_links

Possible fields:

- id
- couple_id
- month_key
- token_hash
- active
- created_at
- expires_at
- revoked_at

Use secure random tokens.

Never use predictable month names as public authorization credentials.

---

# 6. Monthly Organization

Everything should naturally organize around months.

Examples:

- October 2026
- September 2026
- August 2026

The dashboard should show monthly collections.

Each month should display useful information such as:

- Number of memories
- Number of days containing memories
- First memory date
- Last memory date
- Recap availability
- Share status

Example:

```text
October 2026

63 memories
12 days captured

[ View memories ]
[ Generate recap ]
[ Share ]
```

---

# 7. Monthly Recap System

Every month should have an automatically generated video recap.

At the end of each month:

1. Find all memories belonging to that month.
2. Sort them chronologically.
3. Select the appropriate optimized/HD assets.
4. Build a cinematic slideshow/video.
5. Apply subtle transitions.
6. Add optional date or text overlays.
7. Encode to MP4.
8. Upload the generated video to R2.
9. Save its metadata in Supabase.
10. Mark the recap as ready.

The recap must also be manually generated from the dashboard.

Example:

```text
October 2026

63 memories

[ Generate Recap ]
```

The generation system must prevent duplicate or runaway jobs.

If a recap is already processing:

```text
Generating...
```

Do not allow unlimited simultaneous generation requests.

Implement:

- job state
- duplicate prevention
- retry limit
- timeout/failure handling
- clear error state
- safe regeneration

---

# 8. Automatic Generation

Use a scheduled server-side process to trigger monthly recap generation.

The automatic process should:

- determine the previous completed month
- find its memories
- check whether a recap already exists
- avoid generating duplicates
- queue the job
- generate the video
- store the final result

The schedule must use a clearly defined timezone.

Use the application's configured timezone rather than assuming the server's timezone.

The automatic process should be idempotent.

Running it twice should not create duplicate recaps.

---

# 9. Manual Recap Generation

Authenticated users should be able to manually generate or regenerate a recap.

Possible states:

### No recap

`Generate Recap`

### Processing

`Generating...`

Disable duplicate generation.

### Ready

`Watch Recap`

`Download`

`Regenerate`

### Failed

`Generation Failed`

`Try Again`

Provide a useful error message without exposing server secrets or internal stack traces.

---

# 10. Video Recap Design

The recap should NOT look like a generic PowerPoint slideshow.

It should feel cinematic.

Use:

- smooth crossfades
- subtle zoom/pan
- restrained transitions
- carefully timed photo duration
- clean typography
- optional date overlays
- high-quality encoding

Avoid:

- excessive transitions
- spinning effects
- cheesy heart animations
- excessive text
- flashy templates

The photos should remain the focus.

A possible opening:

```text
October 2026

A month of us.
```

Then the memories.

At the end:

```text
October 2026

63 memories.
12 days.
A month worth remembering.
```

The exact copy can be configurable later.

---

# 11. Public Monthly Share Pages

Authenticated users should be able to create a share link for a month.

Example:

`/m/<secure-token>`

Do not make share links predictable.

Do not use:

`/memories/october-2026`

as the authorization mechanism.

The token should be generated using cryptographically secure randomness.

The public page should only expose the selected month's content.

The public viewer should not receive:

- private account information
- upload controls
- edit controls
- internal IDs unnecessarily
- database credentials
- private administrative metadata

---

# 12. Public Page Design

This is one of the most important parts of the product.

The public page should feel like a premium digital album.

Do not show:

- admin dashboard
- sidebar
- upload buttons
- login prompts
- database-style tables

Instead:

```text
October 2026

A month of us.

[beautiful photo collection]

        ↓

October Recap

[ Play ]
```

Use large typography, generous spacing, and photography-first design.

The public viewer should work beautifully on both desktop and mobile.

---

# 13. Private Dashboard Design

The authenticated dashboard can be more functional while still remaining beautiful.

Possible layout:

```text
Our Memories

October 2026
63 memories · 12 days captured

[ Add memories ]
[ View month ]
[ Generate recap ]

--------------------------------

Previous months

September 2026
48 memories

August 2026
72 memories

July 2026
31 memories
```

Keep the interface clean.

Do not make it look like a corporate admin panel.

---

# 14. Visual Design Direction

The design must be:

- Modern
- Minimal
- Premium
- Cinematic
- Editorial
- Personal
- Responsive

The visual language should feel inspired by:

- modern Apple-like interfaces
- premium photography websites
- editorial layouts
- digital scrapbooks

But do NOT directly copy another website's design.

Create an original design system.

---

# 15. Colors

Avoid making the entire application pink or red.

Use a neutral foundation.

## Light Mode

Possible direction:

- warm white
- soft gray
- charcoal
- subtle accent color

## Dark Mode

Possible direction:

- near-black
- off-white
- muted gray
- restrained accent

Use romantic accents sparingly.

For example:

- favorite icon
- small accent
- selected state

Do not fill the interface with hearts.

---

# 16. Typography

Typography should be modern and readable.

Possible font choices:

- Geist
- Inter
- SF-style system typography

Use large, clear headings.

Avoid tiny UI text.

Important information should have strong hierarchy.

For example:

```text
October 2026
```

should feel like a real page heading rather than a tiny dashboard label.

---

# 17. Gallery Design

Do not use a boring uniform grid for everything.

Use an editorial/masonry-inspired gallery where appropriate.

Support:

- portrait photos
- landscape photos
- square photos

Allow selected images to become larger featured items.

Example visual rhythm:

```text
+-------------+----------------------+
|             |                      |
|    PHOTO    |        PHOTO         |
|             |                      |
+-------------+----------------------+

+----------------------+-------------+
|                      |             |
|        PHOTO         |    PHOTO    |
|                      |             |
+----------------------+-------------+
```

Do not distort images.

Always preserve the correct aspect ratio.

Use lazy loading for large galleries.

Use responsive image sizing so mobile devices do not download unnecessarily large assets.

---

# 18. Photo Viewer

Clicking a photo should open a polished fullscreen viewer.

Features:

- fullscreen viewing
- previous/next navigation
- photo date
- caption
- favorite
- HD download for authenticated users
- close button
- keyboard navigation on desktop
- swipe gestures on mobile

Use smooth transitions.

The viewer should prioritize the photo and keep controls unobtrusive.

---

# 19. Upload Experience

Create a modern upload flow.

Example:

```text
Add to our memories

Drop photos here
or
Choose from your device
```

After selection:

```text
12 photos selected

[ thumbnails ]

Date
October 4, 2026

Caption
Sunday date

[ Add memories ]
```

Support:

- multiple uploads
- upload progress
- individual failure states
- retry failed uploads
- cancellation where practical
- duplicate prevention where practical

Do not make the user wait without feedback.

---

# 20. Mobile Experience

Mobile must be treated as a first-class experience.

Do not build desktop first and simply shrink it.

On mobile:

- navigation should be simple
- upload should work naturally from the phone
- gallery should use appropriate columns
- photo viewer should support swipe
- buttons should be touch-friendly
- text must remain readable
- video recap should fit the viewport
- share links should look beautiful

The app should feel like a mobile product even though it is a web application.

---

# 21. Desktop Experience

Desktop should take advantage of the larger screen.

Use:

- wider editorial layouts
- larger photo compositions
- spacious gallery layouts
- cinematic recap presentation
- hover interactions where appropriate

Do not stretch everything unnecessarily.

Use a sensible maximum content width.

---

# 22. Responsive Breakpoints

Design intentionally for:

- small phones
- large phones
- tablets
- laptops
- desktop monitors

Test at common viewport sizes.

Avoid:

- horizontal scrolling
- broken masonry
- oversized buttons
- tiny text
- images overflowing containers

---

# 23. Animations

Animations should be subtle and purposeful.

Good examples:

- fade-in
- slight scale
- smooth gallery transitions
- modal transitions
- hover movement
- page transitions

Avoid:

- constant motion
- bouncing UI
- excessive parallax
- decorative particle systems
- flashy effects

The design should still feel excellent when animations are disabled.

Respect:

`prefers-reduced-motion`

---

# 24. Authentication

Only two people should have accounts.

Do not provide public registration.

The login experience should be simple.

Possible:

- email/password
- secure session handling
- logout

Protect all write operations.

The backend must verify authentication.

Do not trust client-side role checks.

Use Supabase Row Level Security.

---

# 25. Security

Security is important because the application contains personal photographs.

Implement:

- Supabase RLS
- authenticated write access
- server-side privileged operations
- signed media URLs where appropriate
- secure share tokens
- rate limiting for sensitive endpoints
- upload validation
- file-type validation
- file-size limits
- safe image processing
- secure environment variables

Never expose:

- Supabase service-role key
- R2 secret key
- private credentials
- internal processing credentials

in browser code.

---

# 26. Public Sharing Security Model

A public share link grants read-only access to the selected monthly collection.

The share token should be:

- cryptographically random
- sufficiently long
- impossible to reasonably guess

Store a hash of the token when practical.

When a visitor opens:

`/m/<token>`

the server validates the token and determines which month it belongs to.

Revoking a share link must immediately prevent further access.

Allow authenticated users to:

- create share link
- copy share link
- revoke share link
- regenerate share link

---

# 27. Performance

Performance is important because photo-heavy pages can become expensive.

Implement:

- lazy loading
- responsive image sizes
- optimized image formats
- caching where appropriate
- pagination or progressive loading for large galleries
- thumbnail-first loading
- optimized HD loading only when needed
- CDN delivery through the chosen storage architecture

Do not load every full-resolution image immediately when opening a month with hundreds of photos.

---

# 28. Error Handling

Every important operation needs clear states.

Examples:

### Upload

- Uploading
- Processing
- Complete
- Failed
- Retry

### Recap

- Not generated
- Queued
- Processing
- Ready
- Failed

### Share

- Creating
- Ready
- Revoked
- Failed

Do not show raw backend errors to users.

---

# 29. Empty States

Empty states should feel intentional.

Example:

```text
No memories yet.

Every little moment starts somewhere.

[ Add your first memory ]
```

For an empty month:

```text
Nothing here yet.

Maybe this month is just getting started.
```

Keep the writing natural and not overly sentimental.

---

# 30. Future Features

Do not implement all of these in the first version unless architecture requires preparation for them.

Potential future features:

- On This Day
- Anniversary reminders
- Yearly recap
- AI-assisted captions
- AI selection of best memories
- AI-generated recap structure
- favorite memories
- memory tags
- location map
- short videos
- voice notes
- private notes
- couple timeline
- memory search
- custom recap music
- multiple recap styles

Design the architecture so these can be added later.

---

# 31. Suggested MVP

Build the first version around these features:

## Authentication

- Two private accounts
- Login
- Logout
- Session persistence

## Dashboard

- Current month
- Previous months
- Memory counts
- Days captured

## Upload

- Multiple image upload
- Image optimization
- HD version
- Upload progress
- Date
- Caption

## Gallery

- Monthly gallery
- Responsive editorial layout
- Fullscreen photo viewer

## Memory Management

- Edit caption
- Edit date
- Favorite
- Delete

## Sharing

- Generate monthly share link
- Public read-only page
- Revoke share link

## Recaps

- Manual generation
- Automatic monthly generation
- Processing state
- Video playback
- MP4 download

## Responsive Design

- Mobile
- Tablet
- Desktop

---

# 32. Important Design Rules

These rules should be followed throughout the project.

### DO

- Make the photos the visual focus.
- Use strong typography.
- Use generous whitespace.
- Use smooth, subtle animations.
- Make mobile excellent.
- Make the public viewer feel cinematic.
- Keep the dashboard functional but elegant.
- Use modern image optimization.
- Use clear loading states.
- Make everything feel intentional.

### DO NOT

- Make it look like a generic SaaS dashboard.
- Copy Google Photos.
- Overuse glassmorphism.
- Overuse gradients.
- Use giant pink hearts.
- Add unnecessary decorative animations.
- Use tiny typography.
- Create unnecessary sidebars.
- Expose storage credentials.
- Store large media directly in PostgreSQL.
- Make public links predictable.
- Trust frontend-only security.
- Generate unlimited video jobs.

---

# 33. Development Approach

Build this as a production-quality application rather than a quick prototype.

Before writing large amounts of code:

1. Inspect the project structure.
2. Establish the architecture.
3. Create environment variable requirements.
4. Set up Supabase.
5. Set up database schema.
6. Configure RLS.
7. Configure R2.
8. Implement authentication.
9. Implement secure upload pipeline.
10. Implement gallery.
11. Implement public sharing.
12. Implement recap generation.
13. Implement automatic recap scheduling.
14. Polish responsive design.
15. Test security.
16. Test performance.
17. Test mobile and desktop.

Keep components modular.

Avoid giant files.

Use reusable components.

Keep server-only functionality separated from client components.

---

# 34. Environment Variables

Use environment variables for all credentials.

Expected categories include:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY

SUPABASE_SERVICE_ROLE_KEY

R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
R2_PUBLIC_URL or configured CDN URL

APP_URL
```

Use the exact names consistently throughout the application.

Never commit `.env` files containing real secrets.

Provide `.env.example`.

---

# 35. Database Security

Use Supabase RLS policies carefully.

Authenticated users should only be able to modify the shared couple's data if they belong to the authorized couple.

Public visitors should not receive broad direct database access.

Prefer server-side validation for public share-token access.

The service role should only be used in trusted server-side environments.

---

# 36. Recap Processing Architecture

Do not perform heavy video encoding directly inside a normal short-lived web request if the chosen deployment environment cannot reliably support it.

Use an asynchronous job architecture.

Conceptually:

```text
User clicks Generate
        |
        v
Create recap job
        |
        v
Queue / background processor
        |
        v
Collect month photos
        |
        v
Generate MP4
        |
        v
Upload to R2
        |
        v
Update Supabase
        |
        v
Recap Ready
```

Automatic generation should use the same pipeline.

Choose an implementation that is compatible with the actual Vercel/runtime limits rather than assuming long-running server processes are available.

If a separate video-processing service or worker is necessary, keep it isolated from the main web application.

---

# 37. Testing Requirements

Test:

## Authentication

- valid login
- invalid login
- logout
- session persistence
- unauthorized access

## Upload

- one photo
- many photos
- large photo
- unsupported file
- failed upload
- retry
- duplicate upload

## Gallery

- empty month
- one photo
- many photos
- mixed aspect ratios
- mobile
- desktop

## Sharing

- valid token
- invalid token
- revoked token
- expired token if expiration is enabled
- cannot edit through public page

## Recaps

- no memories
- one memory
- many memories
- duplicate generation attempt
- processing state
- failure
- retry
- successful download

## Security

Verify that public visitors cannot:

- upload
- edit
- delete
- generate
- access private dashboard data
- access credentials
- access other unshared months

---

# 38. Final Product Goal

The final result should feel like this:

We log in.

We see our memories.

We upload a few photos from our day.

The system quietly optimizes them.

They appear beautifully in our current month.

At the end of the month, a recap is automatically created.

We can open the recap and watch:

> **October 2026**
>
> *A month of us.*

And if we want to share the month with someone, we send them a link.

They don't need an account.

They simply open it and see a beautiful, read-only memory album.

The application should feel **personal, modern, private, fast, and premium**.

The goal is not to build another photo-storage service.

The goal is to build **our own private place for memories.**
