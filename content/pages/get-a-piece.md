---
type: PageLayout
title: Get a piece
sections:
  - type: GenericSection
    title:
      type: TitleBlock
      text: Get a piece
      color: text-dark
    subtitle: ''
    text: ''
    actions: []
    media:
      type: FormBlock
      fields:
        - type: TextFormControl
          name: name
          label: Name
          hideLabel: true
          placeholder: Your name
          isRequired: true
          width: full
        - type: TextFormControl
          name: Piece
          label: Piece
          hideLabel: true
          placeholder: 'What you''re interested in or #piece id'
          isRequired: true
          width: full
        - type: EmailFormControl
          name: email
          label: Email
          hideLabel: true
          placeholder: Your email
          isRequired: true
          width: full
        - type: TextareaFormControl
          name: message
          label: Message
          hideLabel: true
          placeholder: Optional message
          isRequired: false
          width: full
        - type: CheckboxFormControl
          name: terms
          label: I have read and accept the legal terms
          isRequired: true
          width: full
      submitButton:
        type: SubmitButtonFormControl
        label: Swoosh
        showIcon: false
        icon: arrowRight
        iconPosition: right
        style: primary
      elementId: contact-form
      styles:
        self:
          padding:
            - pt-6
            - pb-6
            - pl-6
            - pr-6
          borderColor: border-dark
          borderStyle: solid
          borderWidth: 1
          borderRadius: large
    badge:
      type: Badge
      label: Found something you like?
      color: text-primary
    colors: bg-light-fg-dark
slug: get-a-piece
isDraft: false
seo:
  type: Seo
  metaTitle: Get a piece
  metaDescription: If you fancy a piece of work - just reach out and get it.
  addTitleSuffix: true
  socialImage: /images/main-hero.jpg
  metaTags: []
---
