# Editor Dialogs and JPEG Upload Design

## Goal

Make editing interactions consistent with the existing mobile behavior: creating an item, editing an item, and editing a box must happen in a modal overlay on every viewport. Image compression must produce JPEG files instead of WebP for ordinary media and profile-avatar uploads.

## Interaction Design

### Item editor

- Opening “新增物品” or editing an existing item displays the same editor dialog.
- Mobile retains the current bottom-sheet presentation.
- Desktop uses a centered, scrollable modal instead of inserting the form into the box-detail content flow.
- The underlying page remains visible but inert, cannot scroll, and is restored when the dialog closes.
- The dialog closes through its close/cancel control, the backdrop, or Escape when no save or upload is in progress.
- Saving refreshes the box data and closes the dialog. Deleting an item closes the editor before showing the existing confirmation dialog.

### Box editor

- Box edit actions in the catalogue card menu, box-detail desktop actions, and box-detail mobile action sheet open a modal.
- The modal reuses `BoxForm` with `presentation="modal"`; it does not introduce a second editing form.
- Mobile uses a bottom sheet and desktop uses a centered, scrollable modal, matching the create-box interaction.
- Successful saves close the dialog, refresh affected box queries, and display the existing success feedback.
- The legacy `/app/boxes/:boxId/edit` route redirects to the box catalogue with that editor open, so saved links no longer render a standalone edit page.

### Shared dialog behavior

The item and box editors use one reusable modal shell for overlay rendering, focus containment, initial focus, Escape and backdrop dismissal, application `inert` state, body scroll locking, responsive sheet/modal layout, and busy-state dismissal protection. Forms remain responsible for their fields, validation, mutations, upload recovery, and completion callbacks.

## JPEG Upload Design

- `useMediaUpload` requests `image/jpeg` from `browser-image-compression` for box covers and item images.
- Profile-avatar compression also requests `image/jpeg`.
- Upload signing and R2 PUT requests continue to use the compressed file’s actual MIME type and size.
- AI packing photos and atlases already produce JPEG and remain unchanged.
- Existing WebP objects remain readable; this change only affects newly compressed uploads.

## State and Data Flow

1. An edit trigger records the target ID or record and opens the appropriate dialog.
2. The dialog loads any required record through the existing queries.
3. The existing form validates and saves the record, then uploads a JPEG when a new image was selected.
4. The completion callback invalidates catalogue and detail queries, closes the dialog, and restores focus to the initiating control where practical.
5. If image upload fails after the record is saved, the existing retry/continue recovery remains available and the dialog stays open until the flow is resolved.

## Error and Safety Behavior

- Initial data-load errors render inside the modal and retain the existing retry action.
- Mutation errors preserve entered values.
- While saving, compressing, signing, uploading, or confirming, dismissal is blocked.
- JPEG compression or oversize failures enter the existing media-error path; no WebP fallback is attempted.

## Testing

- Component tests prove new-item and edit-item forms remain modal dialogs on desktop viewports and never appear as in-flow content.
- Component tests prove every box-edit entry opens a dialog without navigating away.
- Route tests prove the legacy edit URL redirects to the catalogue editor state.
- Dialog tests cover focus isolation, Escape/backdrop dismissal, and busy-state blocking.
- Upload tests require `fileType: 'image/jpeg'` and verify JPEG MIME data reaches signing and PUT calls for media and avatars.
- The web unit suite, typecheck, lint, and production build provide regression coverage.

## Scope

This change does not redesign form fields, alter database MIME constraints, migrate existing stored images, or change AI packing image processing.
