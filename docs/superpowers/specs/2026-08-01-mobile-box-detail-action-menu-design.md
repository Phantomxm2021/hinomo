# Mobile Box Detail Action Menu Design

## Scope

Only the mobile public box-detail experience changes. Desktop keeps its current cover, box facts, inline actions and item-card layout.

## Navigation and actions

The mobile navigation title is `箱子名称 · 箱子详情`. An owner has one trailing `+` button. It opens the existing iOS-style action sheet with three actions: add item, edit box and print label. The persistent mobile add-item button is removed.

## Detail content

On mobile, hide the summary metadata shown in the supplied screenshot (box code, box title, public/private chip and updated time). The existing mobile-hidden cover and desktop-only facts remain desktop-only. The item section begins below the navigation.

## Item media

Every mobile item row displays its image thumbnail when present and the existing box placeholder otherwise. The add/edit bottom-sheet form keeps the file selector and adds an immediate local image preview after a selection; an existing item shows its stored image above the selector.

## Accessibility and errors

The action sheet uses its existing modal focus/escape/backdrop behavior. The plus trigger is labelled `打开箱子操作菜单`; no mutation, upload or error behavior changes.
