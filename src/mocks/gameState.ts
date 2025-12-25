import type { GameResponse } from '../types/game';

export const initialGameResponse: GameResponse = {
  "success": true,
  "gameId": "high-density-test-2025",
  "state": {
    "game_id": "high-density-test-2025",
    "turn_info": {
      "turn_count": 5,
      "current_phase": "MAIN",
      "active_player_id": "p1",
      "winner": null
    },
    "players": {
      "p1": {
        "player_id": "p1",
        "name": "Player 1",
        "life_count": 2,
        "hand_count": 5,
        "leader": {
          "uuid": "leader-p1",
          "card_id": "OP01-002",
          "name": "エドワード・ニューゲート",
          "power": 6000,
          "attribute": "特",
          "is_rest": false,
          "owner_id": "p1",
          "traits": ["四皇", "白ひげ海賊団"],
          "attached_don": 0
        },
        "zones": {
          "field": [
            { 
              "uuid": "p1-c1", "card_id": "OP01-006", "name": "お玉", "power": 0, "cost": 1, 
              "is_rest": false, "owner_id": "p1", "attached_don": 0 
            },
            { 
              "uuid": "p1-c2", "card_id": "OP01-025", "name": "ロロノア・ゾロ", "power": 5000, "cost": 3, 
              "is_rest": false, "owner_id": "p1", "keywords": ["速攻"], "attached_don": 0 
            },
            { 
              "uuid": "p1-c3", "card_id": "OP01-013", "name": "サンジ", "power": 4000, "cost": 2, 
              "is_rest": true, "owner_id": "p1", "attached_don": 0 
            },
            { 
              "uuid": "p1-c4", "card_id": "OP01-016", "name": "ナミ", "power": 3000, "cost": 1, 
              "is_rest": false, "owner_id": "p1", "keywords": ["ブロッカー"], "attached_don": 0 
            },
            { 
              "uuid": "p1-c5", "card_id": "OP01-005", "name": "ニコ・ロビン", "power": 5000, "cost": 3, 
              "is_rest": false, "owner_id": "p1", "attached_don": 0 
            }
          ],
          "hand": [
            { "uuid": "p1-h1", "card_id": "OP01-006", "name": "お玉", "cost": 1, "power": 0, "is_face_up": true, "owner_id": "p1" },
            { "uuid": "p1-h2", "card_id": "OP02-015", "name": "マキノ", "cost": 1, "power": 3000, "is_face_up": true, "owner_id": "p1" },
            { "uuid": "p1-h3", "card_id": "OP01-029", "name": "ラディカルビーム", "cost": 1, "is_face_up": true, "owner_id": "p1" },
            { "uuid": "p1-h4", "card_id": "OP01-016", "name": "ナミ", "cost": 1, "power": 3000, "is_face_up": true, "owner_id": "p1" },
            { "uuid": "p1-h5", "card_id": "OP01-025", "name": "ロロノア・ゾロ", "cost": 3, "power": 5000, "is_face_up": true, "owner_id": "p1" }
          ],
          "life": [],
          "trash": [],
          "stage": {
            "uuid": "p1-s1",
            "card_id": "OP01-027",
            "name": "モビー・ディック号",
            "cost": 2,
            "power": 0,
            "is_rest": false,
            "owner_id": "p1",
            "attached_don": 0
          }
        },
        "don_active": [
            { "uuid": "don-1", "owner_id": "p1", "is_rest": false },
            { "uuid": "don-2", "owner_id": "p1", "is_rest": false }
        ],
        "don_rested": []
      },
      "p2": {
        "player_id": "p2",
        "name": "Player 2",
        "life_count": 5,
        "hand_count": 4,
        "leader": { 
            "uuid": "leader-p2", "card_id": "OP01-060", "owner_id": "p2", 
            "name": "ドフラミンゴ", "power": 5000, "attribute": "特", "is_rest": false, "traits": ["王下七武海"], "attached_don": 0 
        },
        "zones": {
          "field": [
            { "uuid": "p2-c1", "card_id": "OP01-070", "name": "ボア・ハンコック", "power": 5000, "cost": 4, "is_rest": true, "owner_id": "p2", "keywords": ["ブロッカー"], "attached_don": 0 }
          ],
          "hand": [
            { "uuid": "p2-h1", "is_face_up": false, "owner_id": "p2" },
            { "uuid": "p2-h2", "is_face_up": false, "owner_id": "p2" }
          ],
          "life": [],
          "trash": [],
          "stage": null
        },
        "don_active": [],
        "don_rested": []
      }
    }
  }
} as unknown as GameResponse;
