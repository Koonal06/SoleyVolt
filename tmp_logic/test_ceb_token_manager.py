import importlib
import sys
import types
import unittest
from unittest.mock import MagicMock


if "dotenv" not in sys.modules:
    sys.modules["dotenv"] = types.SimpleNamespace(load_dotenv=lambda: None)

if "supabase" not in sys.modules:
    sys.modules["supabase"] = types.SimpleNamespace(
        Client=object,
        create_client=lambda *args, **kwargs: object(),
    )


ceb_token_manager = importlib.import_module("tmp_logic.ceb_token_manager")
CEBTokenEngine = ceb_token_manager.CEBTokenEngine


class FakeResponse:
    def __init__(self, data=None, error=None, status_code=200):
        self.data = data
        self.error = error
        self.status_code = status_code


class FakeQuery:
    def __init__(self, response):
        self._response = response

    def select(self, *_args, **_kwargs):
        return self

    def eq(self, *_args, **_kwargs):
        return self

    def or_(self, *_args, **_kwargs):
        return self

    def order(self, *_args, **_kwargs):
        return self

    def limit(self, *_args, **_kwargs):
        return self

    def single(self):
        return self

    def execute(self):
        return self._response


class FakeSupabase:
    def __init__(self, table_map):
        self._table_map = table_map

    def table(self, name):
        return FakeQuery(self._table_map[name])


class CEBTokenEngineLogicTests(unittest.TestCase):
    def make_engine(self):
        engine = CEBTokenEngine.__new__(CEBTokenEngine)
        engine.yellow_value_rs = 1.0
        return engine

    def test_purchase_green_tokens_success(self):
        engine = self.make_engine()
        wallets = {
            "buyer": {"yellow_balance": 0.0, "red_balance": 0.0, "green_balance": 1.0},
            "seller": {"yellow_balance": 20.0, "red_balance": 0.0, "green_balance": 0.0},
        }

        def fetch_wallet(user_id):
            return dict(wallets[user_id])

        def update_wallet_balances(user_id, yellow_delta=0, red_delta=0, green_delta=0):
            wallets[user_id]["yellow_balance"] += float(yellow_delta)
            wallets[user_id]["red_balance"] += float(red_delta)
            wallets[user_id]["green_balance"] += float(green_delta)
            return dict(wallets[user_id])

        engine._user_exists = lambda user_id: user_id in wallets
        engine._normalize_month = lambda month=None: month or ceb_token_manager.datetime.datetime(2026, 3, 1)
        engine.fetch_user_meter = lambda user_id: {"meter_id": "meter-1"}
        engine.calculate_green_cap = lambda meter_id: 8.0
        engine.get_monthly_green_purchases = lambda user_id, month=None: 1.0
        engine.fetch_wallet = fetch_wallet
        engine.update_wallet_balances = update_wallet_balances
        engine.record_transaction = lambda **kwargs: dict(kwargs, id="tx-1")
        engine.record_green_purchase = lambda **kwargs: dict(kwargs, id="gp-1")

        result = engine.purchase_green_tokens("buyer", "seller", 10)

        self.assertTrue(result["success"])
        self.assertEqual(result["yellow_deducted_from_seller"], 10.0)
        self.assertEqual(result["green_added_to_buyer"], 5.0)
        self.assertEqual(result["buyer_balances"]["green_balance"], 6.0)
        self.assertEqual(result["seller_balances"]["yellow_balance"], 10.0)
        self.assertEqual(result["cap_status"]["remaining"], 2.0)

    def test_purchase_green_tokens_rejects_cap_excess(self):
        engine = self.make_engine()
        engine._user_exists = lambda _user_id: True
        engine.fetch_user_meter = lambda user_id: {"meter_id": "meter-1"}
        engine.calculate_green_cap = lambda meter_id: 4.0
        engine.get_monthly_green_purchases = lambda user_id, month=None: 3.0
        engine.fetch_wallet = MagicMock()
        engine.update_wallet_balances = MagicMock()

        result = engine.purchase_green_tokens("buyer", "seller", 4)

        self.assertFalse(result["success"])
        self.assertEqual(result["error"], "Purchase exceeds green cap")
        self.assertEqual(result["available"], 1.0)
        engine.update_wallet_balances.assert_not_called()

    def test_process_end_of_month_settlement_offsets_red_with_green(self):
        engine = self.make_engine()
        wallet = {"yellow_balance": 0.0, "red_balance": 7.0, "green_balance": 5.0}

        def fetch_wallet(_user_id):
            return dict(wallet)

        def update_wallet_balances(_user_id, yellow_delta=0, red_delta=0, green_delta=0):
            wallet["yellow_balance"] += float(yellow_delta)
            wallet["red_balance"] += float(red_delta)
            wallet["green_balance"] += float(green_delta)
            return dict(wallet)

        engine._user_exists = lambda _user_id: True
        engine.fetch_wallet = fetch_wallet
        engine.update_wallet_balances = update_wallet_balances
        engine.record_transaction = lambda **kwargs: dict(kwargs, id="settlement-1")

        result = engine.process_end_of_month_settlement("user-1", month=ceb_token_manager.datetime.datetime(2026, 3, 1))

        self.assertTrue(result["success"])
        self.assertEqual(result["green_used"], 5.0)
        self.assertEqual(result["red_after"], 2.0)
        self.assertEqual(result["green_after"], 0.0)
        self.assertEqual(result["settlement_record"]["token_type"], "monthly_settlement")

    def test_process_all_users_end_of_month_continues_after_failures(self):
        engine = self.make_engine()
        engine.fetch_all_users = lambda: [{"id": "u1"}, {"id": "u2"}, {"id": "u3"}]
        engine.process_end_of_month_settlement = MagicMock(
            side_effect=[
                {"success": True, "green_used": 2.5, "red_after": 1.0},
                {"success": False, "error": "broken"},
                {"success": True, "green_used": 1.5, "red_after": 0.0},
            ]
        )

        result = engine.process_all_users_end_of_month(month=ceb_token_manager.datetime.datetime(2026, 3, 1))

        self.assertFalse(result["success"])
        self.assertEqual(result["total_users_processed"], 2)
        self.assertEqual(result["total_green_used_across_all_users"], 4.0)
        self.assertEqual(result["total_red_remaining_across_all_users"], 1.0)
        self.assertEqual(len(result["errors"]), 1)

    def test_get_user_transaction_history_deduplicates_mirror_rows(self):
        engine = self.make_engine()
        engine._user_exists = lambda _user_id: True
        engine.supabase = FakeSupabase(
            {
                "wallet_transactions": FakeResponse(
                    data=[
                        {
                            "id": "send-row",
                            "user_id": "seller",
                            "counterparty_user_id": "buyer",
                            "transaction_type": "send",
                            "amount": -5,
                            "description": "Peer green token purchase",
                            "status": "completed",
                            "metadata": {
                                "sender_id": "seller",
                                "receiver_id": "buyer",
                                "token_type": "green_purchase",
                                "amount": 5,
                                "amount_rs": 10,
                                "transfer_group_id": "grp-1",
                            },
                            "created_at": "2026-03-28T10:00:00",
                        },
                        {
                            "id": "receive-row",
                            "user_id": "buyer",
                            "counterparty_user_id": "seller",
                            "transaction_type": "receive",
                            "amount": 5,
                            "description": "Peer green token purchase",
                            "status": "completed",
                            "metadata": {
                                "sender_id": "seller",
                                "receiver_id": "buyer",
                                "token_type": "green_purchase",
                                "amount": 5,
                                "amount_rs": 10,
                                "transfer_group_id": "grp-1",
                            },
                            "created_at": "2026-03-28T10:00:00",
                        },
                        {
                            "id": "system-row",
                            "user_id": "buyer",
                            "counterparty_user_id": None,
                            "transaction_type": "adjustment",
                            "amount": -2,
                            "description": "Automatic monthly settlement",
                            "status": "completed",
                            "metadata": {
                                "sender_id": "buyer",
                                "receiver_id": None,
                                "token_type": "monthly_settlement",
                                "amount": 2,
                                "amount_rs": 4,
                            },
                            "created_at": "2026-03-29T10:00:00",
                        },
                    ]
                )
            }
        )

        result = engine.get_user_transaction_history("buyer", limit=10)

        self.assertTrue(result["success"])
        self.assertEqual(result["total_transactions"], 2)
        self.assertEqual(result["transactions"][0]["direction"], "system")
        self.assertEqual(result["transactions"][1]["direction"], "received")

    def test_create_green_purchase_request_success(self):
        engine = self.make_engine()
        engine._user_exists = lambda _user_id: True
        engine.fetch_user_meter = lambda _user_id: {"meter_id": "meter-1"}
        engine.calculate_green_cap = lambda _meter_id: 10.0
        engine.get_monthly_green_purchases = lambda _user_id, month=None: 1.0
        engine._utc_now_iso = lambda: "2026-03-28T10:00:00+00:00"

        request_table = MagicMock()
        request_table.insert.return_value.single.return_value.execute.return_value = FakeResponse(
            data={"id": "req-1", "status": "pending"}
        )

        supabase = MagicMock()
        supabase.table.return_value = request_table
        engine.supabase = supabase

        result = engine.create_green_purchase_request("buyer", "seller", 10)

        self.assertTrue(result["success"])
        self.assertEqual(result["request_id"], "req-1")
        self.assertEqual(result["yellow_amount"], 10.0)
        self.assertEqual(result["green_amount"], 5.0)
        self.assertEqual(result["cap_status"]["available"], 9.0)

    def test_accept_green_purchase_request_rejects_insufficient_seller_balance(self):
        engine = self.make_engine()
        engine._fetch_purchase_request = lambda _request_id: {
            "id": "req-1",
            "buyer_id": "buyer",
            "seller_id": "seller",
            "amount_rs": 10,
            "yellow_amount": 10,
            "green_amount": 5,
            "status": "pending",
        }
        engine.fetch_wallet = lambda user_id: {
            "yellow_balance": 4 if user_id == "seller" else 0,
            "red_balance": 0,
            "green_balance": 0,
        }

        result = engine.accept_green_purchase_request("req-1", "seller")

        self.assertFalse(result["success"])
        self.assertEqual(result["error"], "Seller has insufficient yellow balance")
        self.assertEqual(result["seller_balance"], 4.0)
        self.assertEqual(result["required_amount"], 10.0)

    def test_get_purchase_request_history_adds_role_and_counterparty(self):
        engine = self.make_engine()
        engine._user_exists = lambda _user_id: True

        request_query = MagicMock()
        request_query.or_.return_value = request_query
        request_query.order.return_value = request_query
        request_query.limit.return_value = request_query
        request_query.execute.return_value = FakeResponse(
            data=[
                {
                    "id": "req-1",
                    "buyer_id": "buyer",
                    "seller_id": "seller",
                    "amount_rs": 10,
                    "yellow_amount": 10,
                    "green_amount": 5,
                    "status": "pending",
                    "updated_at": "2026-03-28T10:00:00+00:00",
                }
            ]
        )

        profiles_query = MagicMock()
        profiles_query.in_.return_value.execute.return_value = FakeResponse(
            data=[
                {"id": "buyer", "full_name": "Buyer Name", "email": "buyer@example.com"},
                {"id": "seller", "full_name": "Seller Name", "email": "seller@example.com"},
            ]
        )

        def table_side_effect(name):
            table = MagicMock()
            if name == "green_purchase_requests":
                table.select.return_value = request_query
                return table
            if name == "profiles":
                table.select.return_value = profiles_query
                return table
            raise AssertionError(f"Unexpected table lookup: {name}")

        supabase = MagicMock()
        supabase.table.side_effect = table_side_effect
        engine.supabase = supabase

        result = engine.get_purchase_request_history("buyer", limit=10)

        self.assertTrue(result["success"])
        self.assertEqual(result["total"], 1)
        self.assertEqual(result["requests"][0]["role"], "buyer")
        self.assertEqual(result["requests"][0]["counterparty"]["name"], "Seller Name")


if __name__ == "__main__":
    unittest.main()
