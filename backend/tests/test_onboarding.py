"""
Tests for the first-login onboarding endpoint.
"""

from fastapi.testclient import TestClient

from models.group import Group


def _group_names(client: TestClient) -> set[str]:
    return {g["name"] for g in client.get("/groups").json()}


class TestOnboarding:
    def test_new_user_is_not_onboarded(self, authenticated_client: TestClient):
        response = authenticated_client.get("/auth/me")
        assert response.status_code == 200
        assert response.json()["onboardingCompleted"] is False

    def test_onboarding_creates_groups_in_user_language(
        self, authenticated_client: TestClient, test_db, test_user
    ):
        test_user.language = "pl"
        test_db.commit()

        response = authenticated_client.post(
            "/users/me/onboarding", json={"groupKeys": ["HOME", "HEALTH"]}
        )
        assert response.status_code == 200
        assert response.json()["onboardingCompleted"] is True

        groups = authenticated_client.get("/groups").json()
        assert {g["name"] for g in groups} == {"Dom", "Zdrowie"}
        assert {g["color"] for g in groups} == {"blue", "red"}

    def test_onboarding_skip_with_empty_list(self, authenticated_client: TestClient):
        response = authenticated_client.post(
            "/users/me/onboarding", json={"groupKeys": []}
        )
        assert response.status_code == 200
        assert response.json()["onboardingCompleted"] is True
        assert authenticated_client.get("/groups").json() == []

    def test_onboarding_skips_existing_names_case_insensitive(
        self, authenticated_client: TestClient, test_db, test_user
    ):
        test_db.add(Group(name="dom", color="blue", user_id=test_user.id))
        test_db.commit()
        test_user.language = "pl"
        test_db.commit()

        response = authenticated_client.post(
            "/users/me/onboarding", json={"groupKeys": ["HOME"]}
        )
        assert response.status_code == 200
        names = [g["name"] for g in authenticated_client.get("/groups").json()]
        assert names == ["dom"]

    def test_onboarding_respects_group_limit(
        self, authenticated_client: TestClient, test_db, test_user
    ):
        test_db.add_all(
            Group(name=f"Existing {i}", color="blue", user_id=test_user.id)
            for i in range(49)
        )
        test_db.commit()

        response = authenticated_client.post(
            "/users/me/onboarding", json={"groupKeys": ["HOME", "WORK"]}
        )
        assert response.status_code == 200
        assert len(authenticated_client.get("/groups").json()) == 50

    def test_onboarding_unknown_key_returns_422(self, authenticated_client: TestClient):
        response = authenticated_client.post(
            "/users/me/onboarding", json={"groupKeys": ["NOPE"]}
        )
        assert response.status_code == 422

    def test_onboarding_repeat_returns_409(self, authenticated_client: TestClient):
        first = authenticated_client.post(
            "/users/me/onboarding", json={"groupKeys": ["HOME"]}
        )
        assert first.status_code == 200
        second = authenticated_client.post(
            "/users/me/onboarding", json={"groupKeys": ["WORK"]}
        )
        assert second.status_code == 409
        assert "USER_ONBOARDING_ALREADY_COMPLETED" in str(second.json()["detail"])

    def test_onboarding_requires_auth(self, client: TestClient):
        response = client.post("/users/me/onboarding", json={"groupKeys": []})
        assert response.status_code == 401
