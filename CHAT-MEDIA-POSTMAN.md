# Sending chat media with Postman

Chat media is uploaded to the configured ImageKit account, then saved as a regular chat message. The recipient receives `message:new` when connected, and the message is available from chat history later.

## Upload and send a media message

- Method: `POST`
- URL: `http://localhost:5001/api/chat/<chatId>/media`
- Authorization: select **Bearer Token** and use a regular login token for a participant in the chat.
- Body: select **form-data** and add:

| Key | Type | Value |
| --- | --- | --- |
| `file` | File | Select an image, video, audio, or supported document |
| `clientMessageId` | Text | A unique value such as `postman-20261006-001` |
| `caption` | Text | Optional caption |

Do not set `Content-Type` manually; Postman adds the multipart boundary.

The endpoint allows one file up to 20 MB. Supported types include JPEG, PNG, WebP, GIF, MP4, WebM, QuickTime video, MPEG/MP4/WAV/OGG audio, PDF, plain text, DOC, and DOCX. The server chooses `IMAGE`, `VIDEO`, `AUDIO`, or `FILE` from the uploaded file's MIME type.

## Read the message later

Use either participant's login token:

`GET http://localhost:5001/api/chat/<chatId>/messages?page=1&limit=30`

The returned message contains the `media` object with its URL, filename, MIME type, and file size. Open the URL to view or download the attachment.

## Configuration

The server uses the existing ImageKit configuration in `.env`:

- `IMAGEKIT_PUBLIC_KEY`
- `IMAGEKIT_PRIVATE_KEY`
- `IMAGEKIT_URL_ENDPOINT`

Keep the private key secret. Upload requests are authenticated and the server verifies chat membership before uploading.
