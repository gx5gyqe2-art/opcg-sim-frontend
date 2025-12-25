import type { GameResponse } from '../types/game';

// 先頭にこれを追記
export const initialGameResponse: GameResponse =  {
  "success": true,
  "gameId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "state": {
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
      "life_count": 4,
      "hand_count": 5,
      "leader": {
        "uuid": "leader-p1",
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
            "uuid": "char-p1-01",
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
            "uuid": "hand-p1-01",
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
          { "uuid": "life-p1-01", "is_face_up": false, "owner_id": "p1" }
        ],
        "trash": []
      },
      "don_active": [{ "uuid": "don-p1-01", "owner_id": "p1", "is_rest": false }],
      "don_rested": []
    },
    "p2": {
      "player_id": "p2",
      "name": "Player 2",
      "life_count": 5,
      "hand_count": 1,
      "leader": {
        "uuid": "leader-p2",
        "card_id": "OP01-002",
        "name": "エドワード・ニューゲート",
        "power": 6000,
        "cost": 0,
        "attribute": "特",
        "is_rest": false,
        "attached_don": 0,
        "owner_id": "p2"
      },
      "zones": {
        "field": [
          {
            "uuid": "char-p2-01",
            "card_id": "OP02-004",
            "name": "スクアード",
            "power": 5000,
            "cost": 3,
            "is_rest": false,
            "attached_don": 0,
            "owner_id": "p2"
          }
        ],
        "hand": [
          {
            "uuid": "hand-p2-01",
            "card_id": "OP01-025",
            "name": "お玉",
            "power": 0,
            "cost": 1,
            "is_rest": false,
            "is_face_up": false,
            "owner_id": "p2"
          }
        ],
        "life": [
          { "uuid": "life-p2-01", "is_face_up": false, "owner_id": "p2" }
        ],
        "trash": []
      },
      "don_active": [],
      "don_rested": [{ "uuid": "don-p2-01", "owner_id": "p2", "is_rest": true }]
    }
  }
}
}as unknown as GameResponse;
