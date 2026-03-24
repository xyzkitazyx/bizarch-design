#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BIZBOK ケイパビリティマップ生成 API
エックスサーバー CGI形式
"""

import json
import sys
import os
import cgi

# CGI ヘッダー出力
print("Content-Type: application/json; charset=utf-8")
print("Access-Control-Allow-Origin: *")
print("Access-Control-Allow-Methods: GET, POST, OPTIONS")
print("Access-Control-Allow-Headers: Content-Type")
print()

# ケイパビリティマップ定義（業界別テンプレート）
CAPABILITY_MAPS = {
    "saas": {
        "name": "SaaS企業",
        "domains": [
            {
                "name": "プロダクト開発",
                "capabilities": ["要件定義", "設計・アーキテクチャ", "開発・テスト", "リリース管理"]
            },
            {
                "name": "カスタマーサクセス",
                "capabilities": ["オンボーディング", "ヘルススコア管理", "チャーン防止", "アップセル"]
            },
            {
                "name": "セールス&マーケティング",
                "capabilities": ["リード生成", "ナーチャリング", "商談管理", "契約・更新"]
            },
            {
                "name": "データ&アナリティクス",
                "capabilities": ["データ基盤", "KPI管理", "予測分析", "レポーティング"]
            }
        ]
    },
    "manufacturing": {
        "name": "製造業",
        "domains": [
            {
                "name": "生産管理",
                "capabilities": ["生産計画", "工程管理", "品質管理", "在庫管理"]
            },
            {
                "name": "サプライチェーン",
                "capabilities": ["調達", "物流", "倉庫管理", "需要予測"]
            },
            {
                "name": "研究開発",
                "capabilities": ["技術開発", "製品設計", "試作・評価", "知財管理"]
            },
            {
                "name": "営業・サービス",
                "capabilities": ["顧客管理", "見積・受注", "アフターサービス", "フィードバック収集"]
            }
        ]
    },
    "finance": {
        "name": "金融業",
        "domains": [
            {
                "name": "リスク管理",
                "capabilities": ["信用リスク", "市場リスク", "オペリスク", "コンプライアンス"]
            },
            {
                "name": "商品・サービス",
                "capabilities": ["商品開発", "価格設定", "チャネル管理", "顧客セグメント"]
            },
            {
                "name": "オペレーション",
                "capabilities": ["決済処理", "口座管理", "本人確認", "レポーティング"]
            },
            {
                "name": "デジタル変革",
                "capabilities": ["DX推進", "API基盤", "データ活用", "AI導入"]
            }
        ]
    }
}

def main():
    method = os.environ.get("REQUEST_METHOD", "GET")

    if method == "OPTIONS":
        sys.exit(0)

    if method == "POST":
        form = cgi.FieldStorage()
        industry = form.getfirst("industry", "saas")
        scale = form.getfirst("scale", "medium")
    else:
        query = os.environ.get("QUERY_STRING", "")
        params = dict(p.split("=") for p in query.split("&") if "=" in p)
        industry = params.get("industry", "saas")
        scale = params.get("scale", "medium")

    capability_map = CAPABILITY_MAPS.get(industry, CAPABILITY_MAPS["saas"])

    response = {
        "status": "ok",
        "industry": industry,
        "scale": scale,
        "capabilityMap": capability_map
    }

    print(json.dumps(response, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
