import { useEffect, useMemo, useState } from "react"
import { adminApi, WithdrawListResponse } from "../services/api"
import { showToast } from "../utils/toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { Copy, Loader2, RefreshCcw, Wallet } from "lucide-react"

interface Withdraw {
  id: string
  clientId: string
  client: {
    id: string
    email: string
    userName?: string
    firstName?: string
    lastName?: string
  } | null
  amount: number
  walletAddress: string
  status: string
  transactionHash?: string
  description?: string
  paymentNetwork?: "USDT_TRC20" | "USDC_POLYGON"
  createdAt: string
  updatedAt: string
}

function Withdraws() {
  const [withdraws, setWithdraws] = useState<Withdraw[]>([])
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    loadWithdraws()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, itemsPerPage])

  const loadWithdraws = async () => {
    try {
      setLoading(true)
      const data = (await adminApi.getWithdraws({
        page: currentPage,
        limit: itemsPerPage,
      })) as WithdrawListResponse<Withdraw>
      setWithdraws(data.data)
      setTotal(data.total)
      setTotalPages(data.totalPages || 1)
      setError(null)
    } catch (err: any) {
      console.error("Failed to load withdraws:", err)
      setError(err.response?.data?.message || "Failed to load withdraws")
    } finally {
      setLoading(false)
    }
  }

  const handleTransfer = async (withdrawId: string) => {
    if (!confirm("Are you sure you want to transfer USDT from the master wallet to the user's address?")) {
      return
    }

    try {
      setAccepting(withdrawId)
      setError(null)
      const result = await adminApi.acceptWithdraw(withdrawId)
      const currency = result.paymentNetwork === "USDC_POLYGON" ? "USDC" : "USDT"
      showToast.success(
        <div>
          <div className="font-semibold">Transfer successful!</div>
          <div className="text-sm mt-1">
            Amount: {Number(result.amount).toFixed(2)} {currency}
          </div>
          {result.transactionHash && (
            <div className="text-xs mt-1 break-all">TX: {result.transactionHash}</div>
          )}
        </div>,
        { autoClose: 6000 }
      )
      await loadWithdraws()
    } catch (err: any) {
      console.error("Transfer failed:", err)
      const errorMessage = err.response?.data?.message || "Failed to process withdrawal"
      setError(errorMessage)
      showToast.error(
        <div>
          <div className="font-semibold">Transfer Failed</div>
          <div className="text-sm mt-1 whitespace-pre-line">{errorMessage}</div>
        </div>,
        { autoClose: 8000 }
      )
    } finally {
      setAccepting(null)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    showToast.success("Copied to clipboard!")
  }

  const paginationMeta = useMemo(() => {
    const maxVisible = 5
    const pageCount = Math.max(totalPages, 1)
    let start = Math.max(1, currentPage - 2)
    let end = Math.min(pageCount, start + maxVisible - 1)
    start = Math.max(1, end - maxVisible + 1)
    const pages = []
    for (let page = start; page <= end; page += 1) {
      pages.push(page)
    }
    return {
      pages,
      showLeftEllipsis: start > 1,
      showRightEllipsis: end < pageCount,
    }
  }, [currentPage, totalPages])

  const startItem = total === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1
  const endItem = Math.min(currentPage * itemsPerPage, total)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-2">
            <Wallet className="h-7 w-7" />
            Withdrawals
          </h1>
          <p className="text-muted-foreground">Review and process withdrawal requests.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <Button variant="outline" size="sm" onClick={loadWithdraws}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Withdrawal Requests</CardTitle>
            <CardDescription>Latest requests and processed transfers.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Rows per page</span>
            <Select
              value={String(itemsPerPage)}
              onValueChange={(value) => {
                setCurrentPage(1)
                setItemsPerPage(Number(value))
              }}
            >
              <SelectTrigger className="w-[90px]">
                <SelectValue placeholder={itemsPerPage} />
              </SelectTrigger>
              <SelectContent>
                {[10, 20, 50].map((count) => (
                  <SelectItem key={count} value={String(count)}>
                    {count}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : withdraws.length === 0 ? (
            <div className="rounded-lg border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              No withdrawal requests found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Wallet</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Transaction</TableHead>
                    <TableHead>Requested</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {withdraws.map((withdraw) => {
                    const currency = withdraw.paymentNetwork === "USDC_POLYGON" ? "USDC" : "USDT"
                    const userLabel = withdraw.client
                      ? `${withdraw.client.firstName || ""} ${withdraw.client.lastName || ""}`.trim() ||
                        withdraw.client.userName ||
                        withdraw.client.email
                      : "Unknown"
                    const statusVariant =
                      withdraw.status === "success"
                        ? "secondary"
                        : withdraw.status === "failed"
                        ? "destructive"
                        : "outline"
                    return (
                      <TableRow key={withdraw.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-foreground">{userLabel}</span>
                            {withdraw.client?.email && (
                              <span className="text-xs text-muted-foreground">{withdraw.client.email}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {Number(withdraw.amount).toFixed(2)} {currency}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-foreground">{withdraw.walletAddress}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => copyToClipboard(withdraw.walletAddress)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusVariant}>{withdraw.status.toUpperCase()}</Badge>
                        </TableCell>
                        <TableCell>
                          {withdraw.transactionHash ? (
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs text-foreground break-all">
                                {withdraw.transactionHash}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => copyToClipboard(withdraw.transactionHash!)}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDate(withdraw.createdAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          {withdraw.status === "pending" ? (
                            <Button
                              size="sm"
                              onClick={() => handleTransfer(withdraw.id)}
                              disabled={accepting === withdraw.id}
                            >
                              {accepting === withdraw.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                              {accepting === withdraw.id ? "Processing" : "Transfer"}
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {!loading && total > 0 && (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {startItem} to {endItem} of {total} withdrawals
          </div>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                  onClick={(event) => {
                    event.preventDefault()
                    setCurrentPage((prev) => Math.max(1, prev - 1))
                  }}
                />
              </PaginationItem>
              {paginationMeta.showLeftEllipsis && (
                <PaginationItem>
                  <PaginationEllipsis />
                </PaginationItem>
              )}
              {paginationMeta.pages.map((page) => (
                <PaginationItem key={page}>
                  <PaginationLink
                    href="#"
                    isActive={page === currentPage}
                    onClick={(event) => {
                      event.preventDefault()
                      setCurrentPage(page)
                    }}
                  >
                    {page}
                  </PaginationLink>
                </PaginationItem>
              ))}
              {paginationMeta.showRightEllipsis && (
                <PaginationItem>
                  <PaginationEllipsis />
                </PaginationItem>
              )}
              <PaginationItem>
                <PaginationNext
                  href="#"
                  className={currentPage >= totalPages ? "pointer-events-none opacity-50" : ""}
                  onClick={(event) => {
                    event.preventDefault()
                    setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                  }}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  )
}

export default Withdraws

