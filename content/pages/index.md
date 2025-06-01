---
title: Home
slug: /
sections:
  - type: GenericSection
    title:
      text: Fine Art
      color: text-dark
      type: TitleBlock
    subtitle: ''
    text: ''
    actions:
      - label: DISCOVER
        altText: Discover
        url: /gallery
        showIcon: false
        icon: arrowRight
        iconPosition: right
        style: secondary
        elementId: ''
        type: Button
      - type: Link
        label: Follow me
        altText: Instagram
        url: 'https://www.instagram.com/maevevamyart'
        showIcon: true
        icon: arrowRight
        iconPosition: right
        style: secondary
        elementId: ''
    media:
      url: /images/gray-painting-placeholder-no-frame-hang-square-vamy.png
      altText: Unblock your team boost your time to production preview
      elementId: ''
      type: ImageBlock
    badge:
      label: MAEVE VAMY
      color: text-primary
      type: Badge
    elementId: ''
    colors: bg-light-fg-dark
    styles:
      self:
        alignItems: center
        flexDirection: row
        padding:
          - pt-16
          - pl-16
          - pb-16
          - pr-16
  - type: FeaturedItemsSection
    title:
      text: Style
      color: text-dark
      styles:
        self:
          textAlign: center
      type: TitleBlock
    subtitle: ''
    items:
      - type: FeaturedItem
        title: Oil
        subtitle: On Canvas
        text: |
          Oil painting doesn't apologize for its mess, or its refusal
          to be rushed. Every brushstroke carries weight, every layer tells a
          story, and every piece demands time to breathe.
        actions: []
        elementId: null
        colors: bg-neutralAlt-fg-dark
        styles:
          self:
            padding:
              - pt-8
              - pl-8
              - pb-8
              - pr-8
            borderRadius: x-large
            flexDirection: row
            justifyContent: center
            textAlign: left
        image:
          type: ImageBlock
          altText: Lightning bolt symbol on red background
          elementId: ''
          url: /images/icon1.svg
          styles:
            self:
              borderRadius: x-large
        tagline: ''
      - title: Realism
        subtitle: Unrealistic
        text: |
          No filters, no hiding, no pretending. Realism strips away the 
          comfortable lies and serves you truth so sharp you'll question what's 
          real and what's canvas.
        image:
          url: /images/icon2.svg
          altText: Featured icon two
          elementId: ''
          type: ImageBlock
        actions: []
        colors: bg-neutralAlt-fg-dark
        styles:
          self:
            padding:
              - pt-8
              - pl-8
              - pb-8
              - pr-8
            borderRadius: x-large
            flexDirection: row
            textAlign: left
            justifyContent: center
        type: FeaturedItem
      - title: Surreal
        subtitle: Vibes
        text: >
          Color doesn't need permission. Form doesn't need explanation. Abstract
          art gives us what realism can't. Step into chaos that somehow makes
          perfect sense.
        image:
          url: /images/icon3.svg
          altText: Featured icon three
          elementId: ''
          type: ImageBlock
        actions: []
        colors: bg-neutralAlt-fg-dark
        styles:
          self:
            padding:
              - pt-8
              - pl-8
              - pb-8
              - pr-8
            borderRadius: x-large
            flexDirection: row
        type: FeaturedItem
    actions:
      - label: CHECK OUT MY WORK
        altText: CHECK OUT MY WORK
        url: /gallery
        showIcon: false
        icon: arrowRight
        iconPosition: right
        style: primary
        elementId: ''
        type: Button
    badge:
      label: ''
      color: text-primary
      styles:
        self:
          textAlign: center
      type: Badge
    elementId: ''
    variant: three-col-grid
    colors: bg-neutral-fg-dark
    styles:
      self:
        padding:
          - pb-16
          - pt-16
          - pl-16
          - pr-16
        justifyContent: center
      subtitle:
        textAlign: center
  - posts:
      - content/pages/gallery/balloony.md
      - content/pages/gallery/doughnut-hole.md
      - content/pages/gallery/blue.md
    showThumbnail: true
    showDate: true
    showAuthor: true
    variant: three-col-grid
    colors: bg-light-fg-dark
    styles:
      self:
        padding:
          - pt-16
          - pl-16
          - pb-16
          - pr-16
        justifyContent: center
    type: FeaturedPostsSection
    hoverEffect: move-up
    actions:
      - type: Button
        label: GET A PIECE
        altText: ''
        url: /get-a-piece
        showIcon: false
        icon: arrowRight
        iconPosition: right
        style: primary
        elementId: ''
  - title: Divider
    colors: bg-light-fg-dark
    styles:
      self:
        padding:
          - pt-7
          - pl-7
          - pb-7
          - pr-7
    type: DividerSection
  - title:
      text: Reach out
      color: text-dark
      type: TitleBlock
    subtitle: ''
    text: ''
    media:
      fields:
        - name: name
          label: Name
          hideLabel: true
          placeholder: Your name
          isRequired: true
          width: full
          type: TextFormControl
        - name: email
          label: Email
          hideLabel: true
          placeholder: Your email
          isRequired: true
          width: full
          type: EmailFormControl
        - name: message
          label: Message
          hideLabel: true
          placeholder: Your message
          width: full
          type: TextareaFormControl
          isRequired: true
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
      type: FormBlock
      submitButton:
        type: SubmitButtonFormControl
        label: Swoosh
        showIcon: false
        icon: arrowRight
        iconPosition: right
        style: primary
        elementId: null
    badge:
      label: Like what you see?
      color: text-primary
      type: Badge
    colors: bg-light-fg-dark
    type: GenericSection
seo:
  metaTitle: Vamy - Fine Arts
  metaDescription: Welcome to the world of Maeve Vamy
  socialImage: /images/main-hero.jpg
  type: Seo
  addTitleSuffix: false
type: PageLayout
---
