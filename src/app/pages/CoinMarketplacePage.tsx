import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Coins,
  HandCoins,
  History,
  Inbox,
  Search,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { useAuth } from "../providers/AuthProvider";
import { supabase } from "../../lib/supabase";
import { getMyWallet, type WalletRow } from "../../lib/supabase-data";
import {
  acceptGreenPurchaseRequest,
  createGreenPurchaseRequest,
  getGreenPurchaseRequestHistory,
  getPendingGreenPurchaseRequests,
  rejectGreenPurchaseRequest,
type GreenPurchaseRequestRecord,
  searchMarketplaceSellers,
  type MarketplaceSellerOption,
} from "../../lib/server-api";

type MarketplaceNotice = {
  tone: "success" | "info";
  title: string;
  detail: string;
};

const numberFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function formatAmount(value: number) {
  return numberFormatter.format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function getStatusTone(status: GreenPurchaseRequestRecord["status"]) {
  switch (status) {
    case "completed":
      return "bg-emerald-100 text-emerald-700";
    case "rejected":
      return "bg-rose-100 text-rose-700";
    case "pending":
      return "bg-amber-100 text-amber-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export function CoinMarketplacePage() {
  const { user, userType } = useAuth();
  const canBuy = userType === "consumer" || userType === "prosumer";
  const canSell = userType === "producer" || userType === "prosumer";
  const defaultTab = canBuy ? "buy" : "sell";

  const [wallet, setWallet] = useState<WalletRow | null>(null);
  const [incomingRequests, setIncomingRequests] = useState<GreenPurchaseRequestRecord[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<GreenPurchaseRequestRecord[]>([]);
  const [history, setHistory] = useState<GreenPurchaseRequestRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<MarketplaceNotice | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MarketplaceSellerOption[]>([]);
  const [selectedSeller, setSelectedSeller] = useState<MarketplaceSellerOption | null>(null);
  const [amountRs, setAmountRs] = useState("");
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});

  const requestPreview = useMemo(() => {
    const rupees = Number(amountRs);
    const normalized = Number.isFinite(rupees) && rupees > 0 ? rupees : 0;

    return {
      amountRs: normalized,
      yellowToSeller: normalized,
      greenToBuyer: normalized / 2,
    };
  }, [amountRs]);

  useEffect(() => {
    let active = true;
    let refreshTimeout = 0;

    async function loadMarketplace(showSpinner: boolean) {
      try {
        if (showSpinner) {
          setIsLoading(true);
          setError(null);
        }

        const [walletData, incomingData, outgoingData, historyData] = await Promise.all([
          getMyWallet(),
          canSell ? getPendingGreenPurchaseRequests(true) : Promise.resolve(null),
          canBuy ? getPendingGreenPurchaseRequests(false) : Promise.resolve(null),
          getGreenPurchaseRequestHistory({ limit: 50 }),
        ]);

        if (!active) {
          return;
        }

        setWallet(walletData);
        setIncomingRequests(incomingData?.success ? incomingData.requests : []);
        setOutgoingRequests(outgoingData?.success ? outgoingData.requests : []);
        setHistory(historyData.success ? historyData.requests : []);
        setError(
          incomingData && !incomingData.success
            ? incomingData.error ?? "Unable to load incoming requests."
            : outgoingData && !outgoingData.success
              ? outgoingData.error ?? "Unable to load outgoing requests."
              : historyData.success
                ? null
                : historyData.error ?? "Unable to load request history.",
        );
      } catch (err) {
        if (active && showSpinner) {
          setError(err instanceof Error ? err.message : "Unable to load coin marketplace.");
        }
      } finally {
        if (active && showSpinner) {
          setIsLoading(false);
        }
      }
    }

    if (!user?.id) {
      setWallet(null);
      setIncomingRequests([]);
      setOutgoingRequests([]);
      setHistory([]);
      setIsLoading(false);

      return () => {
        active = false;
      };
    }

    void loadMarketplace(true);

    if (!supabase) {
      return () => {
        active = false;
      };
    }

    const scheduleRefresh = () => {
      window.clearTimeout(refreshTimeout);
      refreshTimeout = window.setTimeout(() => {
        if (!active) {
          return;
        }

        void loadMarketplace(false);
      }, 200);
    };

    const channel = supabase
      .channel(`coin-market-live-${user.id}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "green_purchase_requests",
          filter: `buyer_id=eq.${user.id}`,
        },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "green_purchase_requests",
          filter: `seller_id=eq.${user.id}`,
        },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "wallets",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (!active) {
            return;
          }

          if (payload.eventType === "DELETE") {
            setWallet(null);
          } else {
            setWallet(payload.new as WalletRow);
          }

          scheduleRefresh();
        },
      )
      .subscribe();

    return () => {
      active = false;
      window.clearTimeout(refreshTimeout);
      void channel.unsubscribe();
    };
  }, [canBuy, canSell, user?.id]);

  useEffect(() => {
    let active = true;

    async function runSearch() {
      if (!canBuy || searchQuery.trim().length < 2) {
        setSearchResults([]);
        return;
      }

      try {
        setIsSearching(true);
        const users = await searchMarketplaceSellers(searchQuery);

        if (active) {
          setSearchResults(users);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Unable to search sellers.");
        }
      } finally {
        if (active) {
          setIsSearching(false);
        }
      }
    }

    const timeoutId = window.setTimeout(runSearch, 250);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [canBuy, searchQuery]);

  const handleCreateRequest = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!canBuy) {
      setError("Your account type cannot create coin purchase requests.");
      return;
    }

    if (!selectedSeller) {
      setError("Choose a seller before sending the request.");
      return;
    }

    if (!Number.isFinite(requestPreview.amountRs) || requestPreview.amountRs <= 0) {
      setError("Enter a rupee amount greater than zero.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      setNotice(null);

      const result = await createGreenPurchaseRequest(selectedSeller.id, requestPreview.amountRs);

      if (!result.success) {
        const capMessage =
          result.error === "Purchase exceeds green cap"
            ? `${result.error}. Available: ${formatAmount(Number(result.available ?? 0))} GC.`
            : result.error ?? "Unable to create purchase request.";
        setError(capMessage);
        return;
      }

      toast.success("Purchase request sent to seller.");
      setNotice({
        tone: "info",
        title: "Purchase request sent",
        detail: `Request sent to ${selectedSeller.full_name ?? "the selected seller"} for Rs ${formatAmount(requestPreview.amountRs)} and ${formatAmount(requestPreview.greenToBuyer)} GC.`,
      });
      setSelectedSeller(null);
      setSearchQuery("");
      setSearchResults([]);
      setAmountRs("");
      const [outgoingData, historyData] = await Promise.all([
        getPendingGreenPurchaseRequests(false),
        getGreenPurchaseRequestHistory({ limit: 50 }),
      ]);
      setOutgoingRequests(outgoingData.success ? outgoingData.requests : []);
      setHistory(historyData.success ? historyData.requests : history);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create purchase request.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAccept = async (requestId: string) => {
    try {
      setIsSubmitting(true);
      setError(null);
      setNotice(null);
      const result = await acceptGreenPurchaseRequest(requestId);

      if (!result.success) {
        setError(result.error ?? "Unable to accept purchase request.");
        return;
      }

      toast.success("Purchase request accepted and wallet updated.");
      setNotice({
        tone: "success",
        title: "Request accepted",
        detail: `Buyer received ${formatAmount(Number(result.green_added ?? 0))} GC and seller now has ${formatAmount(Number(result.seller_balances?.yellow_balance ?? result.seller_balances?.yellow_token ?? 0))} YC remaining.`,
      });
      const [incomingData, historyData, walletData] = await Promise.all([
        getPendingGreenPurchaseRequests(true),
        getGreenPurchaseRequestHistory({ limit: 50 }),
        getMyWallet(),
      ]);
      setIncomingRequests(incomingData.success ? incomingData.requests : []);
      setHistory(historyData.success ? historyData.requests : history);
      setWallet(walletData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to accept purchase request.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      setIsSubmitting(true);
      setError(null);
      setNotice(null);
      const result = await rejectGreenPurchaseRequest(requestId, rejectReasons[requestId] ?? "");

      if (!result.success) {
        setError(result.error ?? "Unable to reject purchase request.");
        return;
      }

      toast.success("Purchase request rejected.");
      setNotice({
        tone: "info",
        title: "Request rejected",
        detail: `The request was rejected${rejectReasons[requestId] ? ` with note: ${rejectReasons[requestId]}` : "."}`,
      });
      const [incomingData, historyData] = await Promise.all([
        getPendingGreenPurchaseRequests(true),
        getGreenPurchaseRequestHistory({ limit: 50 }),
      ]);
      setIncomingRequests(incomingData.success ? incomingData.requests : []);
      setHistory(historyData.success ? historyData.requests : history);
      setRejectReasons((current) => ({ ...current, [requestId]: "" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reject purchase request.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Green Coin Marketplace</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Consumers can request Green Coins, producers can approve or reject requests, and prosumers can do both.
              All purchases follow the fixed settlement rule of 1 Yellow Coin = Rs 1 and 1 Green Coin = Rs 2.
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <p className="font-medium capitalize">{userType ?? "user"} marketplace access</p>
            <p className="mt-1">
              {canBuy ? "Buy requests enabled." : "Buy requests disabled."} {canSell ? "Sell approvals enabled." : "Sell approvals disabled."}
            </p>
          </div>
        </div>
      </section>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}
      {notice ? (
        <div
          className={`rounded-2xl border p-4 text-sm ${
            notice.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-blue-200 bg-blue-50 text-blue-800"
          }`}
        >
          <p className="font-semibold">{notice.title}</p>
          <p className="mt-1">{notice.detail}</p>
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            icon: Coins,
            label: "Your green balance",
            value: `${formatAmount(Number(wallet?.green_token ?? 0))} GC`,
            tone: "bg-emerald-100 text-emerald-700",
          },
          {
            icon: HandCoins,
            label: "Your yellow balance",
            value: `${formatAmount(Number(wallet?.yellow_token ?? 0))} YC`,
            tone: "bg-amber-100 text-amber-700",
          },
          {
            icon: Inbox,
            label: "Incoming requests",
            value: `${incomingRequests.length}`,
            tone: "bg-blue-100 text-blue-700",
          },
          {
            icon: History,
            label: "Total request records",
            value: `${history.length}`,
            tone: "bg-slate-100 text-slate-700",
          },
        ].map((card) => (
          <div key={card.label} className="rounded-[1.8rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ${card.tone}`}>
              <card.icon className="h-6 w-6" />
            </div>
            <p className="text-3xl font-semibold text-slate-950">{isLoading ? "..." : card.value}</p>
            <p className="mt-2 text-sm text-slate-600">{card.label}</p>
          </div>
        ))}
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-amber-700">Fixed conversion</p>
            <p className="mt-2 text-xl font-semibold text-slate-950">1 Yellow Coin = Rs 1</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-emerald-700">Fixed conversion</p>
            <p className="mt-2 text-xl font-semibold text-slate-950">1 Green Coin = Rs 2</p>
          </div>
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-blue-700">Cap protection</p>
            <p className="mt-2 text-sm font-medium text-slate-950">
              Maximum monthly Green Coin purchase = average monthly import / 2
            </p>
          </div>
        </div>
      </section>

      <Tabs defaultValue={defaultTab} className="space-y-6">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-2 rounded-2xl border border-slate-200 bg-white p-2">
          {canBuy ? <TabsTrigger value="buy" className="flex-none px-4 py-2">Buy Coins</TabsTrigger> : null}
          {canBuy ? <TabsTrigger value="my-requests" className="flex-none px-4 py-2">My Requests</TabsTrigger> : null}
          {canSell ? <TabsTrigger value="sell" className="flex-none px-4 py-2">Sell Queue</TabsTrigger> : null}
          <TabsTrigger value="history" className="flex-none px-4 py-2">History</TabsTrigger>
        </TabsList>

        {canBuy ? (
          <TabsContent value="buy">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-xl font-semibold text-slate-950">Create a purchase request</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Choose a seller, enter the rupee value you want to spend off-platform, and send the request for approval.
              </p>

              <form className="mt-6 space-y-6" onSubmit={handleCreateRequest}>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-900">Select seller</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(event) => {
                        setSearchQuery(event.target.value);
                        setSelectedSeller(null);
                        setError(null);
                      }}
                      placeholder="Search seller by name"
                      className="w-full rounded-2xl border border-slate-300 bg-white py-3 pl-10 pr-4 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {searchQuery ? (
                    <div className="mt-2 max-h-64 overflow-auto rounded-2xl border border-slate-200 bg-white">
                      {isSearching ? (
                        <div className="px-4 py-3 text-sm text-slate-500">Searching sellers...</div>
                      ) : searchResults.length > 0 ? (
                        searchResults.map((seller) => (
                          <button
                            key={seller.id}
                            type="button"
                            onClick={() => {
                              setSelectedSeller(seller);
                              setSearchQuery(seller.full_name ?? "Unnamed seller");
                              setSearchResults([]);
                            }}
                            className="flex w-full items-center justify-between border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50 last:border-b-0"
                          >
                            <div>
                              <p className="font-medium text-slate-900">{seller.full_name ?? "Unnamed seller"}</p>
                              <p className="text-sm capitalize text-slate-500">{seller.user_type} seller account</p>
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-3 text-sm text-slate-500">No matching sellers found.</div>
                      )}
                    </div>
                  ) : null}
                </div>

                {selectedSeller ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                    Request will be sent to <span className="font-semibold">{selectedSeller.full_name ?? "selected seller"}</span>.
                  </div>
                ) : null}

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-900">Amount in rupees</label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={amountRs}
                    onChange={(event) => {
                      setAmountRs(event.target.value);
                      setError(null);
                    }}
                    placeholder="0.00"
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Buyer receives</p>
                    <p className="mt-2 text-xl font-semibold text-slate-950">{formatAmount(requestPreview.greenToBuyer)} GC</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Seller gives</p>
                    <p className="mt-2 text-xl font-semibold text-slate-950">{formatAmount(requestPreview.yellowToSeller)} YC</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Buyer pays seller</p>
                    <p className="mt-2 text-xl font-semibold text-slate-950">Rs {formatAmount(requestPreview.amountRs)}</p>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || !selectedSeller || requestPreview.amountRs <= 0}
                  className="inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {isSubmitting ? "Sending request..." : "Send purchase request"}
                </button>
              </form>
            </div>
          </TabsContent>
        ) : null}

        {canBuy ? (
          <TabsContent value="my-requests">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <Inbox className="h-6 w-6 text-blue-600" />
                <h3 className="text-xl font-semibold text-slate-950">Pending requests you sent</h3>
              </div>

              <div className="mt-6 space-y-4">
                {outgoingRequests.length > 0 ? (
                  outgoingRequests.map((request) => (
                    <div key={request.id} className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="font-semibold text-slate-950">
                            Seller: {request.counterparty?.name ?? request.seller?.name ?? request.seller_id.slice(0, 8)}
                          </p>
                          <p className="mt-1 text-sm text-slate-600">
                            Requesting {formatAmount(Number(request.green_amount))} GC for Rs {formatAmount(Number(request.amount_rs))}
                          </p>
                          <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-500">
                            Created {formatDate(request.created_at)}
                          </p>
                        </div>
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium uppercase tracking-[0.14em] ${getStatusTone(request.status)}`}>
                          {request.status}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-500">
                    {isLoading ? "Loading requests..." : "You do not have any pending purchase requests."}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        ) : null}

        {canSell ? (
          <TabsContent value="sell">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-6 w-6 text-amber-600" />
              <h3 className="text-xl font-semibold text-slate-950">Incoming requests to approve</h3>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Accepting a request deducts Yellow Coins from your wallet and credits Green Coins to the buyer.
            </p>

            <div className="mt-6 space-y-4">
              {incomingRequests.length > 0 ? (
                incomingRequests.map((request) => (
                  <div key={request.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <p className="font-semibold text-slate-950">
                          Buyer: {request.counterparty?.name ?? request.buyer?.name ?? request.buyer_id.slice(0, 8)}
                        </p>
                        <p className="text-sm text-slate-600">
                          Buyer wants {formatAmount(Number(request.green_amount))} GC and you will transfer {formatAmount(Number(request.yellow_amount))} YC.
                        </p>
                        <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
                          Requested {formatDate(request.created_at)}
                        </p>
                      </div>

                      <div className="w-full max-w-md space-y-3">
                        <textarea
                          value={rejectReasons[request.id] ?? ""}
                          onChange={(event) =>
                            setRejectReasons((current) => ({
                              ...current,
                              [request.id]: event.target.value,
                            }))
                          }
                          placeholder="Optional rejection note"
                          className="min-h-24 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                        <div className="flex flex-wrap gap-3">
                          <button
                            type="button"
                            disabled={isSubmitting}
                            onClick={() => void handleAccept(request.id)}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-300"
                          >
                            <BadgeCheck className="h-4 w-4" />
                            Accept
                          </button>
                          <button
                            type="button"
                            disabled={isSubmitting}
                            onClick={() => void handleReject(request.id)}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:bg-slate-300"
                          >
                            <XCircle className="h-4 w-4" />
                            Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-500">
                  {isLoading ? "Loading sell queue..." : "No pending buyer requests are waiting for your approval."}
                </div>
              )}
            </div>
          </div>
          </TabsContent>
        ) : null}

        <TabsContent value="history">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <History className="h-6 w-6 text-slate-700" />
              <h3 className="text-xl font-semibold text-slate-950">Marketplace history</h3>
            </div>

            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[860px]">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.16em] text-slate-500">
                    <th className="px-0 py-3">Role</th>
                    <th className="px-4 py-3">Counterparty</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Updated</th>
                    <th className="px-4 py-3">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {history.length > 0 ? (
                    history.map((request) => (
                      <tr key={request.id} className="border-b border-slate-100 text-sm last:border-b-0">
                        <td className="px-0 py-4 capitalize text-slate-900">{request.role ?? "user"}</td>
                        <td className="px-4 py-4 text-slate-700">
                          {request.counterparty?.name ?? request.counterparty?.email ?? request.counterparty?.id ?? "System"}
                        </td>
                        <td className="px-4 py-4 text-slate-700">
                          Rs {formatAmount(Number(request.amount_rs))} / {formatAmount(Number(request.green_amount))} GC
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium uppercase tracking-[0.14em] ${getStatusTone(request.status)}`}>
                            {request.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-slate-500">{formatDate(request.updated_at)}</td>
                        <td className="px-4 py-4 text-slate-500">{request.notes || "-"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-0 py-12 text-center text-sm text-slate-500">
                        {isLoading ? "Loading history..." : "No marketplace history is available yet."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
