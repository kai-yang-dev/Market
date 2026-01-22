import { useEffect, useMemo, useState } from "react"
import { adminApi, MasterWalletTransaction } from "../services/api"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const TYPE_LABELS: Record<MasterWalletTransaction["type"], string> = {
  charge: "Charge",
  withdraw: "Withdraw",
  milestone_payment: "Milestone Payment",
  platform_fee: "Platform Fee",
}

const STATUS_LABELS: Record<MasterWalletTransaction["status"], string> = {
  draft: "Draft",
  pending: "Pending",
  success: "Success",
  failed: "Failed",
  cancelled: "Cancelled",
  withdraw: "Withdraw",
}

const NETWORK_LABELS: Record<NonNullable<MasterWalletTransaction["paymentNetwork"]>, string> = {
  USDT_TRC20: "USDT (TRC20)",
  USDC_POLYGON: "USDC (Polygon)",
}

function MasterWalletTransactions() {
  const [transactions, setTransactions] = useState<MasterWalletTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [typeFilter, setTypeFilter] = useState<MasterWalletTransaction["type"] | "all">("all")
  const [statusFilter, setStatusFilter] = useState<MasterWalletTransaction["status"] | "all">("all")
  const [networkFilter, setNetworkFilter] = useState<MasterWalletTransaction["paymentNetwork"] | "all">("all")
  const itemsPerPage = 10

  useEffect(() => {
    setCurrentPage(1)
  }, [typeFilter, statusFilter, networkFilter])

  useEffect(() => {
    fetchTransactions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, typeFilter, statusFilter, networkFilter])

  const fetchTransactions = async () => {
    try {
      setLoading(true)
      const response = await adminApi.getMasterWalletTransactions({
        page: currentPage,
        limit: itemsPerPage,
        type: typeFilter === "all" ? undefined : typeFilter,
        status: statusFilter === "all" ? undefined : statusFilter,
        paymentNetwork: networkFilter === "all" ? undefined : networkFilter,
      })
      setTransactions(response.data)
      setTotal(response.total)
      setTotalPages(response.totalPages || 1)
    } catch (error) {
      console.error("Failed to load master wallet transactions:", error)
      alert("Failed to load transactions")
    } finally {
      setLoading(false)
    }
  }

  const getStatusVariant = (
    status: MasterWalletTransaction["status"]
  ): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "success":
        return "default"
      case "pending":
        return "secondary"
      case "failed":
      case "cancelled":
        return "destructive"
      default:
        return "outline"
    }
  }

  const getUserLabel = (transaction: MasterWalletTransaction) => {
    const user = transaction.client || transaction.provider
    if (!user) return "System"
    if (user.userName) return user.userName
    if (user.firstName || user.lastName) {
      return `${user.firstName || ""} ${user.lastName || ""}`.trim()
    }
    return user.email || "System"
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
      <div>
        <h1 className="text-3xl font-bold text-foreground">Master Wallet Transactions</h1>
        <p className="text-sm text-muted-foreground">Transaction history recorded in the database.</p>
      </div>

      <Card>
        <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Filter by type, status, and network.</CardDescription>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
            <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as any)}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="charge">Charge</SelectItem>
                <SelectItem value="withdraw">Withdraw</SelectItem>
                <SelectItem value="milestone_payment">Milestone Payment</SelectItem>
                <SelectItem value="platform_fee">Platform Fee</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as any)}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="withdraw">Withdraw</SelectItem>
              </SelectContent>
            </Select>
            <Select value={networkFilter} onValueChange={(value) => setNetworkFilter(value as any)}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Network" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All networks</SelectItem>
                <SelectItem value="USDT_TRC20">USDT (TRC20)</SelectItem>
                <SelectItem value="USDC_POLYGON">USDC (Polygon)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No transactions found.</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Network</TableHead>
                    <TableHead>Wallet</TableHead>
                    <TableHead>Tx Hash</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell className="font-medium text-foreground">
                        {TYPE_LABELS[transaction.type] || transaction.type}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(transaction.status)}>
                          {STATUS_LABELS[transaction.status] || transaction.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium text-foreground">
                        {Number(transaction.amount).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {transaction.paymentNetwork
                          ? NETWORK_LABELS[transaction.paymentNetwork]
                          : "-"}
                      </TableCell>
                      <TableCell className="max-w-[180px]">
                        <p className="truncate text-xs text-muted-foreground">
                          {transaction.walletAddress || "-"}
                        </p>
                      </TableCell>
                      <TableCell className="max-w-[180px]">
                        <p className="truncate text-xs text-muted-foreground">
                          {transaction.transactionHash || "-"}
                        </p>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {getUserLabel(transaction)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(transaction.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {!loading && total > 0 && (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {startItem} to {endItem} of {total} transactions
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

export default MasterWalletTransactions

