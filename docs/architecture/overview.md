# �ܹ���������ǰʵ�֣�

��ǰ������ϵͳλ�� `trip-manager/`��ǰ��˹��� SQLite ���ݿ⡣

## �ܹ�����
```
�����
  ��
Vite Dev Server (5173)
  ��  /api ����
Express API (3001)
  ��
SQLite (trip.db)
```

## �����������̬
- ǰ�ˣ�React + Vite��`trip-manager/frontend`��
  - �����˿ڣ�5173
  - ���������`/api` -> `http://localhost:3001`
- ��ˣ�Node.js + Express��`trip-manager/backend`��
  - ����˿ڣ�3001
  - ·��ģ�飺`trip-manager/backend/src/routes/*`
- ���ݿ⣺SQLite��`trip-manager/backend/db/trip.db`��
  - ��ʼ���ű���`trip-manager/backend/db/init.sql`
  - �������`npm run init-db`����ɾ�����ؽ����ݿ⣩

## ǰ���ͨ��
- ǰ�� `axios` ������ַ��`/api`
- �������ã�`trip-manager/frontend/vite.config.js`

## ��֤��Ȩ��
- HTTP Basic Auth���û��洢�� SQLite��
- ֻ�� `admin` �ɻ�ȡ/���ڱ༭��

## �༭������
- ���`edit_lock`������ id=1��
- ��ȡ��`POST /api/lock/acquire`
- ���ڣ�`POST /api/lock/renew`
- �ͷţ�`POST /api/lock/release`
- �����������û�Ϊ admin�����Զ���ȡ 5 ������

## �ؼ�ͬ����ϵ
- `schedules` ? `activities`��ͨ�� `activities.schedule_id` ������
- `schedules` ���������ͬ������ `activities`
- `activities` ���ʱ��ͬ������ `schedules`

## ������ͼ
- `calendar_view`���ۺ����顢�ص�����Ϣ������������ͳ��

## AI �������ȼ�
- ����������`AI_api_key`��`AI_PROVIDER`��`AI_MODEL`��`AI_TIMEOUT_MS`
- system_config��������Ч����`ai_api_key`��`ai_provider`��`ai_model`��`ai_timeout_ms`
- Ĭ���߼���δ���� `AI_PROVIDER` ʱʹ�� `openai`��δ���� `AI_api_key` ʱ�������ⲿ AI
