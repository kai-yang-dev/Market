import { useEffect, useState } from "react"
import { adminApi, UnblockRequest } from "../services/api"
import { showToast } from "../utils/toast"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CheckCircle2, XCircle, Mail, Calendar, MessageSquare } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

function formatDate(d?: string | null) {
  if (!d) return "—"
  try {
    return new Date(d).toLocaleString()
  } catch {
    return String(d)
  }
}

function getUserName(user: any) {
  if (!user) return "—"
  const full = `${user.firstName || ""} ${user.lastName || ""}`.trim()
  return full || user.userName || user.email || user.id
}

export default function Requests() {
  const [loading, setLoading] = useState(true)
  const [requests, setRequests] = useState<UnblockRequest[]>([])
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [itemsPerPage] = useState(20)
  const [actionDialog, setActionDialog] = useState<{
    requestId: string;
    action: 'approve' | 'reject';
    userName: string;
  } | null>(null)
  const [adminNote, setAdminNote] = useState('')
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    fetchRequests()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, statusFilter])

  const fetchRequests = async () => {
    try {
      setLoading(true)
      const response = await adminApi.getUnblockRequests({
        page: currentPage,
        limit: itemsPerPage,
        status: statusFilter === 'all' ? undefined : statusFilter,
      })
      setRequests(response.data)
      setTotal(response.total)
      setTotalPages(response.totalPages)
    } catch (error: any) {
      console.error("Failed to fetch unblock requests:", error)
      showToast.error(error.response?.data?.message || "Failed to load unblock requests")
    } finally {
      setLoading(false)
    }
  }

  const handleActionClick = (requestId: string, action: 'approve' | 'reject', userName: string) => {
    setActionDialog({ requestId, action, userName })
    setAdminNote('')
  }

  const handleAction = async () => {
    if (!actionDialog) return

    setProcessing(true)
    try {
      if (actionDialog.action === 'approve') {
        await adminApi.approveUnblockRequest(actionDialog.requestId, adminNote || undefined)
        showToast.success("Unblock request approved and user account activated")
      } else {
        await adminApi.rejectUnblockRequest(actionDialog.requestId, adminNote || undefined)
        showToast.success("Unblock request rejected")
      }
      setActionDialog(null)
      setAdminNote('')
      fetchRequests()
    } catch (error: any) {
      console.error("Action failed:", error)
      showToast.error(error.response?.data?.message || `Failed to ${actionDialog.action} request`)
    } finally {
      setProcessing(false)
    }
  }

  const filteredRequests = requests

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-2">
            <MessageSquare className="w-7 h-7" />
            Unblock Requests
          </h1>
          <p className="text-muted-foreground">
            Review and manage user account unblock requests.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <Tabs value={statusFilter} onValueChange={(v) => {
            setStatusFilter(v as any)
            setCurrentPage(1)
          }}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="approved">Approved</TabsTrigger>
              <TabsTrigger value="rejected">Rejected</TabsTrigger>
            </TabsList>
          </Tabs>

          <Button variant="outline" size="sm" onClick={fetchRequests}>
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Unblock Requests</CardTitle>
          <CardDescription>
            Showing {requests.length} of {total} requests
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="rounded-lg border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              No unblock requests found.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead>Decided</TableHead>
                  <TableHead>Decided By</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      <div className="font-medium">{getUserName(request.user)}</div>
                      {request.user?.email && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {request.user.email}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="max-w-md">
                      <div className="text-sm whitespace-pre-wrap break-words line-clamp-3">
                        {request.message}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          request.status === "pending"
                            ? "secondary"
                            : request.status === "approved"
                              ? "default"
                              : "destructive"
                        }
                      >
                        {request.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(request.createdAt)}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {request.decidedAt ? (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(request.decidedAt)}
                        </div>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {request.decidedBy ? getUserName(request.decidedBy) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {request.status === "pending" ? (
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="default"
                            className="gap-2"
                            onClick={() => handleActionClick(request.id, 'approve', getUserName(request.user))}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-2"
                            onClick={() => handleActionClick(request.id, 'reject', getUserName(request.user))}
                          >
                            <XCircle className="w-4 h-4" />
                            Reject
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Processed</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!actionDialog} onOpenChange={(open) => !open && setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog?.action === 'approve' ? 'Approve' : 'Reject'} Unblock Request
            </DialogTitle>
            <DialogDescription>
              {actionDialog?.action === 'approve'
                ? `Approve the unblock request from ${actionDialog?.userName}? This will activate their account.`
                : `Reject the unblock request from ${actionDialog?.userName}?`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="admin-note">Admin Note (Optional)</Label>
              <Textarea
                id="admin-note"
                placeholder="Add a note about this decision..."
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setActionDialog(null)
                setAdminNote('')
              }}
              disabled={processing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAction}
              disabled={processing}
              variant={actionDialog?.action === 'reject' ? 'destructive' : 'default'}
            >
              {processing ? 'Processing...' : actionDialog?.action === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

