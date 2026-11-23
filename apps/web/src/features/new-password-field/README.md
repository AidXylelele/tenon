# new-password-field

The field where a person chooses a password: on reset, on accepting an invitation and on changing it in Settings → Account. It says the rule the api checks (at least 12 characters, at most 128) under its label, and the browser saves what is typed as a new password.

Owner: web — pages.

## API

`<NewPasswordField name label autoFocus? note? />` inside a form.

- `name`: the form field the server action reads, also the input's id.
- `label`: the visible label.
- `autoFocus`: takes the focus when the page opens it as its first field.
- `note`: a sentence after the rule, such as "Every other session ends."

## Consumers

- `spaces/identity/modules/password-reset`
- `spaces/identity/modules/invitation-acceptance`
- `spaces/settings/modules/account`

## Playground

`new-password-field.stories.tsx`: the field alone, with a note, and focused.
