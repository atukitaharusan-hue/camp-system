export default function NoticeSection() {
  const notices = [
    {
      title: 'チェックイン受付場所',
      content: '管理棟フロントにてQRコードをご提示ください。',
    },
    {
      title: '受付時に必要なもの',
      content:
        'この画面（またはスクリーンショット）をご準備ください。本人確認書類が必要な場合があります。',
    },
    {
      title: '予約内容の変更について',
      content:
        '予約内容の変更・キャンセルは管理者へ直接ご連絡ください。',
    },
    {
      title: 'スクリーンショット保存',
      content:
        '当日の通信環境に不安がある場合は、事前にこの画面のスクリーンショットを保存しておくことをおすすめします。',
    },
    {
      title: 'その他のご案内',
      content:
        '悪天候時の対応やイベント情報などは、別途メールまたはLINEにてご案内する場合があります。',
    },
  ];

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-gray-800">ご利用にあたって</h2>
      </div>
      <div className="space-y-4 px-5 py-4">
        {notices.map((notice) => (
          <div key={notice.title}>
            <p className="text-sm font-medium text-gray-700">{notice.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-gray-500">
              {notice.content}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
