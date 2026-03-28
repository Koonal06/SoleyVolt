import { useEffect, useState } from "react";
import { Send, Search, CheckCircle, XCircle } from "lucide-react";
import {
  getMyWallet,
  searchUsers,
  transferTokens,
  type PublicUserRow,
  type WalletRow,
} from "../../lib/supabase-data";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../providers/AuthProvider";

const numberFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function formatAmount(value: number) {
  return numberFormatter.format(value);
}

export function Transfer() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<PublicUserRow | null>(null);
  const [results, setResults] = useState<PublicUserRow[]>([]);
  const [amount, setAmount] = useState("");
  const [wallet, setWallet] = useState<WalletRow | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("Your tokens have been sent.");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    let active = true;
    let refreshTimeout = 0;

    async function loadWalletBalance() {
      try {
        const data = await getMyWallet();

        if (!active) {
          return;
        }

        setWallet(data);
        setErrorMessage("");
      } catch (err) {
        if (active) {
          setErrorMessage(err instanceof Error ? err.message : "Unable to load wallet balance.");
        }
      }
    }

    if (!user?.id) {
      setWallet(null);
      return () => {
        active = false;
      };
    }

    void loadWalletBalance();

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

        void loadWalletBalance();
      }, 150);
    };

    const channel = supabase
      .channel(`transfer-wallet-live-${user.id}-${Math.random().toString(36).slice(2)}`)
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
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "wallet_transactions",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          if (!active) {
            return;
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
  }, [user?.id]);

  useEffect(() => {
    let active = true;

    async function runSearch() {
      if (searchQuery.trim().length < 2) {
        setResults([]);
        return;
      }

      try {
        setIsSearching(true);
        const users = await searchUsers(searchQuery);

        if (active) {
          setResults(users);
        }
      } catch (err) {
        if (active) {
          setErrorMessage(err instanceof Error ? err.message : "Unable to search users.");
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
  }, [searchQuery]);

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedUser) {
      setErrorMessage("Choose a receiver before sending tokens.");
      return;
    }

    const parsedAmount = Number(amount);

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setErrorMessage("Enter a valid amount greater than zero.");
      return;
    }

    try {
      setIsLoading(true);
      setShowSuccess(false);
      setErrorMessage("");

      await transferTokens(selectedUser.id, parsedAmount, `Transfer to ${selectedUser.full_name ?? "user"}`);
      const nextWallet = await getMyWallet();

      setWallet(nextWallet);
      setSuccessMessage(`Sent ${formatAmount(parsedAmount)} SLT to ${selectedUser.full_name ?? "the selected user"}.`);
      setShowSuccess(true);
      setAmount("");
      setSelectedUser(null);
      setSearchQuery("");
      setResults([]);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Transfer failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      {showSuccess && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <CheckCircle className="h-6 w-6 text-emerald-600" />
          <div>
            <p className="text-emerald-900">Transfer successful</p>
            <p className="text-sm text-emerald-700">{successMessage}</p>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <XCircle className="h-6 w-6 text-red-600" />
          <div>
            <p className="text-red-900">Transfer failed</p>
            <p className="text-sm text-red-700">{errorMessage}</p>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <Send className="h-8 w-8 text-amber-500" />
          <h2 className="text-blue-900">Send Tokens</h2>
        </div>

        <form onSubmit={handleTransfer} className="space-y-6">
          <div>
            <label className="mb-2 block text-blue-900">Search Receiver</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSuccess(false);
                  setErrorMessage("");
                }}
                placeholder="Search by full name..."
                className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {searchQuery && (
              <div className="mt-2 max-h-60 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                {isSearching ? (
                  <div className="px-4 py-3 text-center text-gray-500">Searching users...</div>
                ) : results.length > 0 ? (
                  results.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => {
                        setSelectedUser(user);
                        setSearchQuery(user.full_name ?? "Unnamed user");
                        setResults([]);
                      }}
                      className="flex w-full items-center justify-between border-b border-gray-100 px-4 py-3 text-left hover:bg-gray-50 last:border-0"
                    >
                      <div>
                        <p className="text-blue-900">{user.full_name ?? "Unnamed user"}</p>
                        <p className="text-sm text-gray-600">Verified SoleyVolt account</p>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-3 text-center text-gray-500">No users found</div>
                )}
              </div>
            )}
          </div>

          {selectedUser && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <p className="mb-1 text-sm text-emerald-700">Sending to:</p>
              <p className="text-emerald-900">{selectedUser.full_name ?? "Unnamed user"}</p>
              <p className="text-sm text-emerald-700">Wallet-ready SoleyVolt user</p>
            </div>
          )}

          <div>
            <label className="mb-2 block text-blue-900">Amount (SLT)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              min="0.01"
              step="0.01"
              required
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <p className="mt-2 text-sm text-gray-600">
              Available balance: {formatAmount(Number(wallet?.balance ?? 0))} SLT
            </p>
          </div>

          <button
            type="submit"
            disabled={!selectedUser || !amount || isLoading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 px-6 py-3 text-blue-900 hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
          >
            {isLoading ? (
              <>
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-900 border-t-transparent" />
                Processing...
              </>
            ) : (
              <>
                <Send className="h-5 w-5" />
                Send Tokens
              </>
            )}
          </button>
        </form>
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-6">
        <h3 className="mb-3 text-blue-900">Transfer Information</h3>
        <ul className="space-y-2 text-sm text-blue-800">
          <li>Transfers run through the live `transfer_tokens` backend RPC.</li>
          <li>Insufficient balance and invalid receiver errors come directly from Supabase.</li>
          <li>Sender and receiver balances refresh automatically when their wallet activity changes.</li>
          <li>You can send only to registered SoleyVolt users returned by the public directory.</li>
        </ul>
      </div>
    </div>
  );
}
