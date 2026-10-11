export type TransferStep = "form" | "review" | "processing" | "success"

export type TransferField = "fromAccount" | "toAccount" | "amount" | "date" | "memo"

export type TransferValues = Record<TransferField, string>
export type TransferErrors = Partial<Record<TransferField, string>>

export interface SourceAccount {
  id: string
  name: string
  masked: string
  currency: "USD" | "CRC"
  balance: number
}

export interface SavedRecipient {
  id: string
  name: string
  masked: string
  bank: string
}

export interface Destination {
  id: string
  name: string
  masked: string
  bank?: string
  kind: "account" | "recipient"
}

export const sourceAccounts: SourceAccount[] = [
  {
    id: "acc-checking",
    name: "Everyday Checking",
    masked: "•••• 4821",
    currency: "USD",
    balance: 3240.55,
  },
  {
    id: "acc-savings",
    name: "High-Yield Savings",
    masked: "•••• 1937",
    currency: "USD",
    balance: 12875,
  },
  {
    id: "acc-colones",
    name: "Cuenta Colones",
    masked: "•••• 6604",
    currency: "CRC",
    balance: 845000,
  },
]

export const savedRecipients: SavedRecipient[] = [
  {
    id: "rcp-maria",
    name: "María Solano",
    masked: "•••• 2210",
    bank: "Northfield Bank",
  },
  {
    id: "rcp-studio",
    name: "Ridgeline Design Studio",
    masked: "•••• 7745",
    bank: "Harbor Trust",
  },
  {
    id: "rcp-landlord",
    name: "Oakview Rentals",
    masked: "•••• 3058",
    bank: "Northfield Bank",
  },
]

export const fieldOrder: TransferField[] = [
  "fromAccount",
  "toAccount",
  "amount",
  "date",
  "memo",
]

const currencySymbols: Record<SourceAccount["currency"], string> = {
  USD: "$",
  CRC: "₡",
}

function toLocalDateValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function getTodayValue() {
  return toLocalDateValue(new Date())
}

export function getMaxTransferDate() {
  const today = new Date()
  const targetYear = today.getFullYear() + 1
  const month = today.getMonth()
  const day = today.getDate()
  const maximumDay = new Date(targetYear, month + 1, 0).getDate()
  return toLocalDateValue(
    new Date(targetYear, month, Math.min(day, maximumDay)),
  )
}

export function createDefaultValues(): TransferValues {
  return {
    fromAccount: "",
    toAccount: "",
    amount: "",
    date: getTodayValue(),
    memo: "",
  }
}

export function getSourceAccount(id: string) {
  return sourceAccounts.find((account) => account.id === id)
}

export function getDestination(id: string): Destination | undefined {
  const account = getSourceAccount(id)
  if (account) {
    return {
      id: account.id,
      name: account.name,
      masked: account.masked,
      kind: "account",
    }
  }

  const recipient = savedRecipients.find((item) => item.id === id)
  if (!recipient) return undefined

  return {
    id: recipient.id,
    name: recipient.name,
    masked: recipient.masked,
    bank: recipient.bank,
    kind: "recipient",
  }
}

export function getCurrency(values: TransferValues) {
  return getSourceAccount(values.fromAccount)?.currency ?? "USD"
}

export function getCurrencySymbol(values: TransferValues) {
  return currencySymbols[getCurrency(values)]
}

export function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatAccessibleMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    currencyDisplay: "name",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatLongDate(value: string) {
  if (!value) return ""
  const [year, month, day] = value.split("-").map(Number)
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(year, month - 1, day))
}

const numberPattern = /^-?(?:\d+(?:\.\d*)?|\.\d+)$/

export function parseAmount(value: string) {
  const trimmed = value.trim()
  if (!numberPattern.test(trimmed)) return undefined
  const amount = Number(trimmed)
  return Number.isFinite(amount) ? amount : undefined
}

export function formatAmountInput(value: string) {
  const trimmed = value.trim()
  const parsed = parseAmount(trimmed)
  const decimals = trimmed.split(".")[1]?.length ?? 0

  if (parsed === undefined || decimals > 2) return value
  return parsed.toFixed(2)
}

export function validateTransfer(values: TransferValues): TransferErrors {
  const errors: TransferErrors = {}
  const fromAccount = getSourceAccount(values.fromAccount)

  if (!values.fromAccount) {
    errors.fromAccount = "Select the account to transfer from."
  }

  if (!values.toAccount) {
    errors.toAccount = "Select an account or recipient to transfer to."
  } else if (values.toAccount === values.fromAccount) {
    errors.toAccount =
      "Choose a different account. You can't transfer to the same account."
  }

  const amountText = values.amount.trim()
  const amount = parseAmount(amountText)
  const decimals = amountText.split(".")[1]?.length ?? 0

  if (!amountText) {
    errors.amount = "Enter an amount."
  } else if (amount === undefined) {
    errors.amount = "Enter a valid amount, e.g. 150.00."
  } else if (amount <= 0) {
    errors.amount = "Amount must be greater than 0."
  } else if (decimals > 2) {
    errors.amount = "Use no more than 2 decimal places."
  } else if (
    fromAccount &&
    values.date === getTodayValue() &&
    amount > fromAccount.balance
  ) {
    errors.amount = `Amount exceeds your available balance of ${formatMoney(
      fromAccount.balance,
      fromAccount.currency,
    )}.`
  }

  if (!values.date) {
    errors.date = "Select a transfer date."
  } else if (values.date < getTodayValue()) {
    errors.date = "Date can't be in the past."
  } else if (values.date > getMaxTransferDate()) {
    errors.date = "Choose a date within the next 12 months."
  }

  if (values.memo.length > 140) {
    errors.memo = "Memo must be 140 characters or fewer."
  }

  return errors
}

export function createTransferReference() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  const code = Array.from(
    bytes,
    (byte) => alphabet[byte % alphabet.length],
  ).join("")
  return `TRF-${code}`
}
