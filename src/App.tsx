import {
  Badge,
  Button,
  ButtonGroup,
  InputField,
  Modal,
  SelectField,
  TextareaField,
  X,
} from "@figma/astraui"
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type RefObject,
} from "react"
import {
  createDefaultValues,
  createTransferReference,
  fieldOrder,
  formatAccessibleMoney,
  formatAmountInput,
  formatLongDate,
  formatMoney,
  getCurrency,
  getCurrencySymbol,
  getDestination,
  getMaxTransferDate,
  getSourceAccount,
  getTodayValue,
  parseAmount,
  savedRecipients,
  sourceAccounts,
  validateTransfer,
  type TransferErrors,
  type TransferField,
  type TransferStep,
  type TransferValues,
} from "./money-transfer"

const actionButtonClass = "h-auto p-xl"
const errorControlClass = "rounded-corner-md border-2 border-danger"

interface SelectOption {
  value: string
  label: string
}

interface AccessibleSelectProps {
  id: string
  labelId: string
  options: SelectOption[]
  value: string
  placeholder: string
  describedBy?: string
  invalid: boolean
  unavailableValue?: string
  onChange: (value: string) => void
  onBlur: () => void
  focusRef: RefObject<HTMLElement | null>
}

function AccessibleSelect({
  id,
  labelId,
  options,
  value,
  placeholder,
  describedBy,
  invalid,
  unavailableValue,
  onChange,
  onBlur,
  focusRef,
}: AccessibleSelectProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const blurTimeoutRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return

    const applyAccessibility = () => {
      const combobox = wrapper.querySelector<HTMLElement>('[role="combobox"]')
      if (combobox) {
        combobox.id = id
        combobox.setAttribute("aria-labelledby", labelId)
        combobox.setAttribute("aria-invalid", String(invalid))
        if (describedBy) {
          combobox.setAttribute("aria-describedby", describedBy)
        } else {
          combobox.removeAttribute("aria-describedby")
        }
        focusRef.current = combobox
      }

      wrapper
        .querySelectorAll<HTMLElement>('[role="option"]')
        .forEach((item) => {
          const isUnavailable =
            Boolean(unavailableValue) &&
            item.textContent?.includes("Unavailable — selected as From")
          item.setAttribute("aria-disabled", String(isUnavailable))
          item.classList.toggle("opacity-50", isUnavailable)
          item.classList.toggle("cursor-not-allowed", isUnavailable)
        })
    }

    applyAccessibility()
    const observer = new MutationObserver(applyAccessibility)
    observer.observe(wrapper, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [describedBy, focusRef, id, invalid, labelId, unavailableValue])

  useEffect(
    () => () => {
      if (blurTimeoutRef.current) {
        window.clearTimeout(blurTimeoutRef.current)
      }
    },
    [],
  )

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    const wrapper = event.currentTarget
    if (wrapper.contains(event.relatedTarget)) return

    if (blurTimeoutRef.current) {
      window.clearTimeout(blurTimeoutRef.current)
    }

    blurTimeoutRef.current = window.setTimeout(() => {
      if (!wrapper.contains(document.activeElement)) onBlur()
    }, 200)
  }

  return (
    <div ref={wrapperRef} onBlur={handleBlur}>
      <SelectField
        options={options}
        value={value}
        placeholder={placeholder}
        state={value ? "default" : "empty"}
        className={invalid ? errorControlClass : undefined}
        onChange={(nextValue) => {
          if (nextValue !== unavailableValue) onChange(nextValue)
        }}
      />
    </div>
  )
}

function FieldLabel({
  htmlFor,
  id,
  children,
}: {
  htmlFor: string
  id?: string
  children: string
}) {
  return (
    <label
      id={id}
      htmlFor={htmlFor}
      className="text-label-sm font-medium text-text-primary"
    >
      {children}
    </label>
  )
}

function FieldMessage({
  id,
  error,
  helper,
}: {
  id: string
  error?: string
  helper?: string
}) {
  return (
    <div className="flex flex-col gap-xs">
      {error && (
        <div
          id={`${id}-error`}
          className="flex items-start gap-sm text-video-title text-danger"
        >
          <span className="shrink-0" aria-hidden="true">
            <X size={16} />
          </span>
          <span>{error}</span>
        </div>
      )}
      {helper && (
        <div
          id={`${id}-helper`}
          className="text-video-title text-text-secondary"
        >
          {helper}
        </div>
      )}
    </div>
  )
}

function ErrorSummary({
  errors,
  summaryRef,
  onFocusField,
}: {
  errors: TransferErrors
  summaryRef: RefObject<HTMLDivElement | null>
  onFocusField: (field: TransferField) => void
}) {
  const entries = fieldOrder.flatMap((field) =>
    errors[field] ? [[field, errors[field]] as const] : [],
  )

  if (!entries.length) return null

  return (
    <div
      ref={summaryRef}
      role="alert"
      tabIndex={-1}
      className="rounded-corner-lg border-2 border-danger bg-bg-faint p-xl outline-none"
    >
      <div className="flex items-start gap-md">
        <span className="shrink-0 text-danger" aria-hidden="true">
          <X size={16} />
        </span>
        <div className="flex flex-1 flex-col gap-md">
          <div
            role="heading"
            aria-level={2}
            className="text-label font-semibold text-text-primary"
          >
            Please fix {entries.length}{" "}
            {entries.length === 1 ? "error" : "errors"} to continue
          </div>
          <div className="flex flex-col items-start gap-xs">
            {entries.map(([field, message]) => (
              <Button
                key={field}
                type="button"
                variant="subtle"
                size="small"
                className="h-auto justify-start whitespace-normal text-left text-danger underline"
                onClick={() => onFocusField(field)}
              >
                {message}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function StepIndicator({ step }: { step: TransferStep }) {
  const current = step === "form" ? 1 : step === "success" ? 3 : 2
  const steps = ["Details", "Review", "Done"]

  return (
    <div
      className="flex w-full items-start"
      aria-label={`Step ${current} of 3: ${steps[current - 1]}`}
    >
      {steps.map((label, index) => (
        <div key={label} className="contents">
          <div className="flex shrink-0 flex-col items-center gap-sm text-center">
            <span
              className={
                index + 1 === current
                  ? "grid size-12 place-items-center rounded-corner-full border-4 border-brand-tertiary bg-brand-primary text-label font-semibold text-on-brand"
                  : "grid size-12 place-items-center rounded-corner-full border-4 border-transparent bg-bg-subtle text-label text-text-secondary"
              }
              aria-hidden="true"
            >
              {index + 1}
            </span>
            <span
              className={
                index + 1 === current
                  ? "text-label-sm font-semibold text-brand-primary"
                  : "text-label-sm text-text-secondary"
              }
              aria-current={index + 1 === current ? "step" : undefined}
            >
              {label}
            </span>
          </div>
          {index < steps.length - 1 && (
            <span
              className="mx-md mt-6 flex-1 border-t border-border-primary"
              aria-hidden="true"
            />
          )}
        </div>
      ))}
    </div>
  )
}

function InfoNotice() {
  return (
    <div
      className="flex items-center gap-md rounded-corner-lg bg-bg-faint p-lg"
      role="note"
    >
      <Badge label="Demo" variant="secondary" />
      <span className="text-label-sm text-text-primary">
        This is a demo. No real money will be moved.
      </span>
    </div>
  )
}

export default function App() {
  const [step, setStep] = useState<TransferStep>("form")
  const [values, setValues] = useState<TransferValues>(createDefaultValues)
  const [touched, setTouched] =
    useState<Partial<Record<TransferField, boolean>>>({})
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReturnStep, setCancelReturnStep] = useState<"form" | "review">(
    "form",
  )
  const [reference, setReference] = useState("")

  const headingRef = useRef<HTMLDivElement>(null)
  const summaryRef = useRef<HTMLDivElement>(null)
  const dialogWrapperRef = useRef<HTMLDivElement>(null)
  const cancelTriggerRef = useRef<HTMLElement | null>(null)
  const wasCancelOpenRef = useRef(false)
  const fieldRefs = {
    fromAccount: useRef<HTMLElement>(null),
    toAccount: useRef<HTMLElement>(null),
    amount: useRef<HTMLInputElement>(null),
    date: useRef<HTMLInputElement>(null),
    memo: useRef<HTMLTextAreaElement>(null),
  }

  const errors = useMemo(() => validateTransfer(values), [values])
  const visibleErrors = useMemo(
    () =>
      fieldOrder.reduce<TransferErrors>((result, field) => {
        if ((touched[field] || submitAttempted) && errors[field]) {
          result[field] = errors[field]
        }
        return result
      }, {}),
    [errors, submitAttempted, touched],
  )

  const fromAccount = getSourceAccount(values.fromAccount)
  const destination = getDestination(values.toAccount)
  const currency = getCurrency(values)
  const amount = parseAmount(values.amount) ?? 0
  const isToday = values.date === getTodayValue()
  const isProcessing = step === "processing"

  const fromOptions = sourceAccounts.map((account) => ({
    value: account.id,
    label: `${account.name} · ${account.masked} — Available ${formatMoney(
      account.balance,
      account.currency,
    )}`,
  }))

  const toOptions = [
    ...sourceAccounts.map((account) => ({
      value: account.id,
      label:
        account.id === values.fromAccount
          ? `My accounts — ${account.name} · ${account.masked} — Unavailable — selected as From`
          : `My accounts — ${account.name} · ${account.masked}`,
    })),
    ...savedRecipients.map((recipient) => ({
      value: recipient.id,
      label: `Saved recipients — ${recipient.name} · ${recipient.bank} ${recipient.masked}`,
    })),
  ]

  const title =
    step === "form"
      ? "Money Transfer Form"
      : step === "success"
        ? isToday
          ? "Transfer submitted"
          : "Transfer scheduled"
        : "Review your transfer"

  const subtitle =
    step === "form"
      ? "Move money between your accounts or send it to a saved recipient."
      : step === "success"
        ? undefined
        : "Check the details before you confirm."

  const announcement =
    step === "form"
      ? "Details step"
      : step === "review"
        ? "Review step"
        : step === "processing"
          ? "Transfer processing"
          : isToday
            ? "Transfer submitted"
            : "Transfer scheduled"

  useEffect(() => {
    if (step !== "processing") headingRef.current?.focus()
  }, [step])

  useEffect(() => {
    if (step !== "processing") return
    const timeout = window.setTimeout(() => setStep("success"), 1500)
    return () => window.clearTimeout(timeout)
  }, [step])

  useEffect(() => {
    if (submitAttempted && Object.keys(errors).length > 0) {
      summaryRef.current?.focus()
    }
  }, [submitAttempted])

  useEffect(() => {
    if (!cancelOpen) {
      if (wasCancelOpenRef.current) {
        window.requestAnimationFrame(() => cancelTriggerRef.current?.focus())
      }
      wasCancelOpenRef.current = false
      return
    }

    wasCancelOpenRef.current = true
    const wrapper = dialogWrapperRef.current
    const dialog = wrapper?.querySelector<HTMLElement>('[role="dialog"]')
    if (!dialog) return

    const buttons = Array.from(
      dialog.querySelectorAll<HTMLButtonElement>("button:not([disabled])"),
    )
    const closeButton = buttons.find(
      (button) => button.textContent?.trim() === "",
    )
    closeButton?.setAttribute("aria-label", "Keep editing")
    const safeAction = buttons.find((button) =>
      button.textContent?.includes("Keep editing"),
    )
    safeAction?.focus()

    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      )
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener("keydown", trapFocus)
    return () => document.removeEventListener("keydown", trapFocus)
  }, [cancelOpen])

  const resetTransfer = () => {
    setValues(createDefaultValues())
    setTouched({})
    setSubmitAttempted(false)
    setReference("")
    setStep("form")
  }

  const updateValue = (field: TransferField, value: string) => {
    setValues((current) => ({ ...current, [field]: value }))
  }

  const touchField = (field: TransferField) => {
    setTouched((current) => ({ ...current, [field]: true }))
  }

  const describedBy = (field: TransferField, helper = true) => {
    const ids = []
    if (visibleErrors[field]) ids.push(`${field}-error`)
    if (helper) ids.push(`${field}-helper`)
    return ids.join(" ") || undefined
  }

  const focusField = (field: TransferField) => {
    fieldRefs[field].current?.focus()
  }

  const openCancel = (returnStep: "form" | "review", trigger: HTMLElement) => {
    cancelTriggerRef.current = trigger
    setCancelReturnStep(returnStep)
    setCancelOpen(true)
  }

  const keepEditing = () => {
    setCancelOpen(false)
    setStep(cancelReturnStep)
  }

  const discardTransfer = () => {
    setCancelOpen(false)
    resetTransfer()
  }

  const continueToReview = () => {
    setSubmitAttempted(true)
    setTouched({
      fromAccount: true,
      toAccount: true,
      amount: true,
      date: true,
      memo: true,
    })
    if (Object.keys(errors).length) {
      window.requestAnimationFrame(() => summaryRef.current?.focus())
      return
    }
    setSubmitAttempted(false)
    setStep("review")
  }

  const confirmTransfer = () => {
    setReference(createTransferReference())
    setStep("processing")
  }

  const renderFormActions = () => (
    <>
      <ButtonGroup align="stack" className="sm:hidden">
        <Button type="submit" variant="primary" className={actionButtonClass}>
          Continue to review
        </Button>
        <Button
          type="button"
          variant="neutral"
          className={actionButtonClass}
          onClick={(event) => openCancel("form", event.currentTarget)}
        >
          Cancel
        </Button>
      </ButtonGroup>
      <ButtonGroup align="end" className="hidden sm:flex">
        <Button
          type="button"
          variant="neutral"
          className={actionButtonClass}
          onClick={(event) => openCancel("form", event.currentTarget)}
        >
          Cancel
        </Button>
        <Button type="submit" variant="primary" className={actionButtonClass}>
          Continue to review
        </Button>
      </ButtonGroup>
    </>
  )

  const renderReviewActions = () => (
    <>
      <ButtonGroup align="stack" className="sm:hidden">
        <Button
          type="button"
          variant="primary"
          className={actionButtonClass}
          disabled={isProcessing}
          aria-disabled={isProcessing}
          aria-busy={isProcessing}
          iconStart={
            isProcessing ? (
              <span
                className="inline-block shrink-0 animate-spin rounded-corner-full border-2 border-t-transparent p-md text-on-brand"
                aria-hidden="true"
              />
            ) : undefined
          }
          onClick={confirmTransfer}
        >
          {isProcessing ? "Sending…" : "Confirm transfer"}
        </Button>
        <Button
          type="button"
          variant="neutral"
          className={actionButtonClass}
          disabled={isProcessing}
          onClick={() => setStep("form")}
        >
          Edit details
        </Button>
        <Button
          type="button"
          variant="subtle"
          className={actionButtonClass}
          disabled={isProcessing}
          onClick={(event) => openCancel("review", event.currentTarget)}
        >
          Cancel
        </Button>
      </ButtonGroup>
      <ButtonGroup align="end" className="hidden sm:flex">
        <Button
          type="button"
          variant="subtle"
          className={actionButtonClass}
          disabled={isProcessing}
          onClick={(event) => openCancel("review", event.currentTarget)}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="neutral"
          className={actionButtonClass}
          disabled={isProcessing}
          onClick={() => setStep("form")}
        >
          Edit details
        </Button>
        <Button
          type="button"
          variant="primary"
          className={actionButtonClass}
          disabled={isProcessing}
          aria-disabled={isProcessing}
          aria-busy={isProcessing}
          iconStart={
            isProcessing ? (
              <span
                className="inline-block shrink-0 animate-spin rounded-corner-full border-2 border-t-transparent p-md text-on-brand"
                aria-hidden="true"
              />
            ) : undefined
          }
          onClick={confirmTransfer}
        >
          {isProcessing ? "Sending…" : "Confirm transfer"}
        </Button>
      </ButtonGroup>
    </>
  )

  return (
    <main className="min-h-screen bg-brand-tertiary p-xl font-sans sm:p-2xl">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-xl">
        <div className="flex flex-col gap-lg">
          <div className="flex flex-wrap items-start justify-between gap-lg">
            <div className="flex flex-col gap-xs">
              <div
                ref={headingRef}
                role="heading"
                aria-level={1}
                tabIndex={-1}
                className="text-title text-text-primary outline-none"
              >
                {title}
              </div>
              {subtitle && (
                <div className="text-label-sm text-text-secondary">
                  {subtitle}
                </div>
              )}
            </div>
          </div>
          <StepIndicator step={step} />
        </div>

        <div className="sr-only" aria-live="polite">
          {announcement}
        </div>

        <section
          className="rounded-corner-lg bg-surface-bg p-xl"
          aria-busy={isProcessing}
        >
          {step === "form" && (
            <form
              className="flex flex-col gap-xl"
              noValidate
              onSubmit={(event) => {
                event.preventDefault()
                continueToReview()
              }}
            >
              <ErrorSummary
                errors={visibleErrors}
                summaryRef={summaryRef}
                onFocusField={focusField}
              />

              <div className="flex flex-col gap-lg">
                <div className="flex flex-col gap-sm">
                  <FieldLabel id="fromAccount-label" htmlFor="fromAccount">
                    From (required)
                  </FieldLabel>
                  <AccessibleSelect
                    id="fromAccount"
                    labelId="fromAccount-label"
                    options={fromOptions}
                    value={values.fromAccount}
                    placeholder="Select an account"
                    describedBy={describedBy(
                      "fromAccount",
                      Boolean(fromAccount),
                    )}
                    invalid={Boolean(visibleErrors.fromAccount)}
                    onChange={(value) => updateValue("fromAccount", value)}
                    onBlur={() => touchField("fromAccount")}
                    focusRef={fieldRefs.fromAccount}
                  />
                  <FieldMessage
                    id="fromAccount"
                    error={visibleErrors.fromAccount}
                    helper={
                      fromAccount
                        ? `Available: ${formatMoney(
                            fromAccount.balance,
                            fromAccount.currency,
                          )}`
                        : undefined
                    }
                  />
                </div>

                <div className="flex flex-col gap-sm">
                  <FieldLabel id="toAccount-label" htmlFor="toAccount">
                    To (required)
                  </FieldLabel>
                  <AccessibleSelect
                    id="toAccount"
                    labelId="toAccount-label"
                    options={toOptions}
                    value={values.toAccount}
                    placeholder="Select an account or recipient"
                    describedBy={describedBy("toAccount", false)}
                    invalid={Boolean(visibleErrors.toAccount)}
                    unavailableValue={values.fromAccount}
                    onChange={(value) => updateValue("toAccount", value)}
                    onBlur={() => touchField("toAccount")}
                    focusRef={fieldRefs.toAccount}
                  />
                  <FieldMessage
                    id="toAccount"
                    error={visibleErrors.toAccount}
                  />
                </div>

                <div className="flex flex-col gap-sm">
                  <FieldLabel htmlFor="amount">Amount (required)</FieldLabel>
                  <div
                    ref={(node) => {
                      fieldRefs.amount.current =
                        node?.querySelector("input") ?? null
                    }}
                  >
                    <InputField
                      id="amount"
                      value={values.amount}
                      prefix={getCurrencySymbol(values)}
                      suffix={currency}
                      inputMode="decimal"
                      placeholder="0.00"
                      aria-invalid={Boolean(visibleErrors.amount)}
                      aria-describedby={describedBy("amount")}
                      className={
                        visibleErrors.amount ? errorControlClass : undefined
                      }
                      onChange={(value) => updateValue("amount", value)}
                      onBlur={() => {
                        touchField("amount")
                        updateValue("amount", formatAmountInput(values.amount))
                      }}
                    />
                  </div>
                  <FieldMessage
                    id="amount"
                    error={visibleErrors.amount}
                    helper="Enter an amount up to your available balance."
                  />
                </div>

                <div className="flex flex-col gap-sm">
                  <FieldLabel htmlFor="date">
                    Transfer date (required)
                  </FieldLabel>
                  <div
                    ref={(node) => {
                      fieldRefs.date.current =
                        node?.querySelector("input") ?? null
                    }}
                  >
                    <InputField
                      id="date"
                      type="date"
                      value={values.date}
                      min={getTodayValue()}
                      max={getMaxTransferDate()}
                      aria-invalid={Boolean(visibleErrors.date)}
                      aria-describedby={describedBy("date")}
                      className={
                        visibleErrors.date ? errorControlClass : undefined
                      }
                      onChange={(value) => updateValue("date", value)}
                      onBlur={() => touchField("date")}
                    />
                  </div>
                  <FieldMessage
                    id="date"
                    error={visibleErrors.date}
                    helper="Choose today or a future date. Future dates are scheduled."
                  />
                </div>

                <div className="flex flex-col gap-sm">
                  <FieldLabel htmlFor="memo">Memo (optional)</FieldLabel>
                  <div
                    ref={(node) => {
                      fieldRefs.memo.current =
                        node?.querySelector("textarea") ?? null
                    }}
                  >
                    <TextareaField
                      id="memo"
                      value={values.memo}
                      rows={2}
                      maxLength={140}
                      placeholder="e.g. October rent"
                      aria-invalid={Boolean(visibleErrors.memo)}
                      aria-describedby={describedBy("memo")}
                      className={
                        visibleErrors.memo ? errorControlClass : undefined
                      }
                      onChange={(value) => updateValue("memo", value)}
                      onBlur={() => touchField("memo")}
                    />
                  </div>
                  <FieldMessage
                    id="memo"
                    error={visibleErrors.memo}
                    helper={`Visible to you and the recipient. ${values.memo.length}/140`}
                  />
                </div>
              </div>

              <InfoNotice />
              {renderFormActions()}
            </form>
          )}

          {(step === "review" || step === "processing") &&
            fromAccount &&
            destination && (
              <div className="flex flex-col gap-xl">
                <div className="flex flex-col gap-lg">
                  <div className="flex flex-col gap-xs bg-bg-faint p-xl rounded-corner-lg">
                    <span className="text-label-sm text-text-secondary">
                      Amount
                    </span>
                    <span
                      className="text-heading font-semibold text-text-primary"
                      aria-hidden="true"
                    >
                      {formatMoney(amount, currency)} {currency}
                    </span>
                    <span className="sr-only">
                      {formatAccessibleMoney(amount, currency)}
                    </span>
                  </div>

                  {[
                    {
                      label: "From",
                      value: `${fromAccount.name} · ${fromAccount.masked}`,
                    },
                    {
                      label: "To",
                      value: `${destination.name} · ${destination.masked}`,
                    },
                    {
                      label: "Date",
                      value: isToday
                        ? "Today"
                        : `Scheduled for ${formatLongDate(values.date)}`,
                    },
                    {
                      label: "Memo",
                      value: values.memo || "—",
                    },
                    ...(isToday
                      ? [
                          {
                            label: "Balance after transfer",
                            value: formatMoney(
                              fromAccount.balance - amount,
                              fromAccount.currency,
                            ),
                          },
                        ]
                      : []),
                  ].map((row) => (
                    <div
                      key={row.label}
                      className="flex flex-col gap-xs border-b border-border-secondary pb-lg sm:grid sm:grid-cols-2 sm:gap-xl"
                    >
                      <span className="text-label-sm text-text-secondary">
                        {row.label}
                      </span>
                      <span className="text-label text-text-primary sm:text-right">
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>

                {renderReviewActions()}
              </div>
            )}

          {step === "success" && destination && (
            <div className="flex flex-col gap-xl">
              <div className="flex flex-col items-start gap-lg">
                <Badge
                  label={isToday ? "Submitted" : "Scheduled"}
                  variant="success"
                />
                <div className="flex flex-col gap-xs">
                  <p className="text-heading text-text-primary">
                    {formatMoney(amount, currency)} to {destination.name} on{" "}
                    {formatLongDate(values.date)}.
                  </p>
                  <p className="text-label-sm text-text-secondary">
                    Reference: {reference}
                  </p>
                </div>
              </div>

              <div
                className="rounded-corner-lg bg-bg-faint p-lg text-label-sm text-text-primary"
                role="note"
              >
                Simulation only — no real money was moved.
              </div>

              <Button
                type="button"
                variant="primary"
                className={actionButtonClass}
                onClick={resetTransfer}
              >
                Make another transfer
              </Button>
            </div>
          )}
        </section>
      </div>

      <div ref={dialogWrapperRef}>
        <Modal
          isOpen={cancelOpen}
          onClose={keepEditing}
          title="Cancel this transfer?"
          size="small"
          footer={
            <>
              <Button
                type="button"
                variant="neutral"
                className={actionButtonClass}
                onClick={keepEditing}
              >
                Keep editing
              </Button>
              <Button
                type="button"
                variant="neutral"
                className={`${actionButtonClass} border-danger text-danger`}
                onClick={discardTransfer}
              >
                Discard transfer
              </Button>
            </>
          }
        >
          <p className="text-label text-text-primary">
            The details you entered will be discarded.
          </p>
        </Modal>
      </div>
    </main>
  )
}
