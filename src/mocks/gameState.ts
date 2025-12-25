{
  "game_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "turn_info": {
    "turn_count": 3,
    "current_phase": "MAIN",
    "active_player_id": "p1",
    "winner": null
  },
  "players": {
    "p1": {
      "player_id": "p1",
      "name": "Player 1",
      "leader": {
        "uuid": "leader-uuid-123",
        "card_id": "OP01-001",
        "name": "ロロノア・ゾロ",
        "power": 5000,
        "cost": 0,
        "attribute": "斬",
        "is_rest": false,
        "attached_don": 0,
        "owner_id": "p1"
      },
      "zones": {
        "field": [
          {
            "uuid": "char-uuid-456",
            "card_id": "OP01-016",
            "name": "ナミ",
            "power": 3000,
            "cost": 1,
            "is_rest": true,
            "attached_don": 1,
            "owner_id": "p1",
            "keywords": ["ブロッカー"]
          }
        ],
        "hand": [
          {
            "uuid": "hand-uuid-789",
            "card_id": "OP01-013",
            "name": "サンジ",
            "power": 4000,
            "cost": 2,
            "is_rest": false,
            "is_face_up": true,
            "owner_id": "p1"
          }
        ],
        "life": [
          {
            "uuid": "life-uuid-001",
            "is_face_up": false,
            "owner_id": "p1"
          }
        ],
        "trash": []
      },
      "don_active": [
        { "uuid": "don-1", "owner_id": "p1", "is_rest": false, "attached_to": null }
      ],
      "don_rested": [],
      "life_count": 4,
      "hand_count": 5
    },
    "p2": {
      "player_id": "p2",
      "name": "Player 2",
      "leader": { "uuid": "leader-p2", "card_id": "OP01-002", "owner_id": "p2" },
      "zones": {
        "field": [],
        "hand": [],
        "life": [],
        "trash": []
      },
      "don_active": [],
      "don_rested": [],
      "life_count": 5,
      "hand_count": 5
    }
  }
}
