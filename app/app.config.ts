export default defineAppConfig({
  ui: {
    colors: { primary: 'blue', neutral: 'zinc' },
    button: {
      slots: { base: 'rounded-md font-medium' },
      defaultVariants: { size: 'md' }
    },
    badge: { slots: { base: 'rounded-sm font-medium' } },
    input: { slots: { base: 'rounded-md' } },
    inputNumber: { slots: { base: 'rounded-md' } },
    select: { slots: { base: 'rounded-md' } },
    modal: { slots: { content: 'rounded-lg ring-1 ring-default shadow-lg', title: 'text-base font-semibold', description: 'text-sm text-muted' } },
    tabs: { slots: { trigger: 'text-sm font-medium' } },
    formField: { slots: { label: 'text-sm font-medium', hint: 'text-xs text-muted', description: 'text-xs text-muted' } }
  }
})
